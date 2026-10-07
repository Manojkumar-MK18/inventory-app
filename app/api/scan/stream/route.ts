import { getContext } from "@/lib/context";
import { registerPos, unregisterPos } from "@/lib/scanHub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE stream the POS billing screen subscribes to, keyed by its pairing code.
 * Authenticated (the POS has the session cookie); the room is bound to the
 * caller's businessId so scans can only reach the right shop.
 *
 *   GET /api/scan/stream?pair=XY12AB
 */
export async function GET(req: Request) {
  const ctx = await getContext(); // redirects if not signed in
  const pair = new URL(req.url).searchParams.get("pair")?.trim();
  if (!pair) return new Response("Missing pair code", { status: 400 });

  const clientId = crypto.randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      registerPos(pair, ctx.businessId, { id: clientId, send });
      // Tell the POS it's connected and ready.
      send({ type: "CONNECTION_STATUS", connected: true, pair });

      // Heartbeat so proxies / phones don't drop the idle connection.
      const beat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { /* closed */ }
      }, 25000);

      const close = () => {
        clearInterval(beat);
        unregisterPos(pair, clientId);
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      unregisterPos(pair, clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
