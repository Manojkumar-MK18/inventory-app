import os from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the shop PC's LAN IPv4 address(es) so the POS can build a scanner URL
 * the PHONE can actually reach (localhost only works on the PC itself).
 * Private-range addresses are listed first (the ones phones on the shop Wi-Fi use).
 */
export async function GET() {
  const ifaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const list of Object.values(ifaces)) {
    for (const ni of list ?? []) {
      // IPv4, not loopback/internal.
      if (ni.family === "IPv4" && !ni.internal) ips.push(ni.address);
    }
  }
  const isPrivate = (ip: string) =>
    ip.startsWith("192.168.") || ip.startsWith("10.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  ips.sort((a, b) => Number(isPrivate(b)) - Number(isPrivate(a)));

  return Response.json({ ips });
}
