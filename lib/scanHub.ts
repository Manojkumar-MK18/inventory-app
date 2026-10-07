/**
 * In-memory pub/sub for the wireless phone scanner.
 *
 * The POS billing screen (authenticated) opens an SSE stream and registers a
 * short "pairing code" together with its businessId. The phone (NOT logged in)
 * POSTs a scanned barcode + that pairing code; the server looks the product up
 * scoped to the room's businessId and pushes the result to the paired POS.
 *
 * This works because the shop runs ONE Node process — no Redis/extra service.
 * A `globalThis` singleton keeps the hub stable across Next.js HMR in dev.
 */

export interface ScanClient {
  id: string;
  send: (event: unknown) => void;
}

interface Room {
  businessId: string;
  clients: Map<string, ScanClient>;
}

const g = globalThis as unknown as { __scanHub?: Map<string, Room> };
const rooms: Map<string, Room> = g.__scanHub ?? (g.__scanHub = new Map());

/** Register a POS SSE client under a pairing code (creates the room if needed). */
export function registerPos(pair: string, businessId: string, client: ScanClient): void {
  let room = rooms.get(pair);
  if (!room || room.businessId !== businessId) {
    room = { businessId, clients: new Map() };
    rooms.set(pair, room);
  }
  room.clients.set(client.id, client);
}

/** Remove a POS client; drop the room when empty. */
export function unregisterPos(pair: string, clientId: string): void {
  const room = rooms.get(pair);
  if (!room) return;
  room.clients.delete(clientId);
  if (room.clients.size === 0) rooms.delete(pair);
}

/** The businessId a pairing code is bound to, or null if nobody is paired. */
export function businessForPair(pair: string): string | null {
  return rooms.get(pair)?.businessId ?? null;
}

/** Push an event to every POS client on a pairing code. Returns how many got it. */
export function pushToPair(pair: string, event: unknown): number {
  const room = rooms.get(pair);
  if (!room) return 0;
  for (const c of room.clients.values()) {
    try { c.send(event); } catch { /* client closing; ignore */ }
  }
  return room.clients.size;
}
