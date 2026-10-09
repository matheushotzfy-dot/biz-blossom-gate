// SSRF guard shared by any edge function that performs outbound fetches to
// user-provided / seller-provided URLs (webhook-dispatcher, apps-dispatcher).
//
// Defense in depth:
//  1. Only http(s) URLs are allowed; forces HTTPS when `requireHttps` is set.
//  2. The hostname is resolved via Deno.resolveDns (A + AAAA) and every
//     resolved IP is checked against private/loopback/link-local/CGNAT/
//     metadata ranges. DNS-rebinding can't bypass this because we fetch the
//     already-resolved IP is not pinned, but the check happens immediately
//     before the request, and `redirect: "manual"` stops any 3xx hop from
//     retargeting the request without going through this same validation
//     again (callers must re-run `assertSafeUrl` on the Location header if
//     they want to follow it).
//  3. Outbound requests never follow redirects automatically — a 3xx is
//     treated as a hard failure ("redirect não permitido").

const IPV4_PRIVATE_RANGES: Array<[number, number]> = [
  [ipToInt("10.0.0.0"), ipToInt("10.255.255.255")],
  [ipToInt("172.16.0.0"), ipToInt("172.31.255.255")],
  [ipToInt("192.168.0.0"), ipToInt("192.168.255.255")],
  [ipToInt("127.0.0.0"), ipToInt("127.255.255.255")],
  [ipToInt("169.254.0.0"), ipToInt("169.254.255.255")],
  [ipToInt("100.64.0.0"), ipToInt("100.127.255.255")], // CGNAT
  [ipToInt("0.0.0.0"), ipToInt("0.255.255.255")],
];

function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return false;
  const n = ipToInt(ip);
  return IPV4_PRIVATE_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower.startsWith("fe80:") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // fc00::/7 unique local
  // IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) must be checked as IPv4 too.
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped && isPrivateIPv4(mapped[1])) return true;
  return false;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  return ip.includes(":") ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

/**
 * Resolves the hostname (A + AAAA) and rejects if it's an IP literal or
 * resolves to any private/loopback/link-local/CGNAT/metadata address.
 * Throws with a safe, generic message on any violation.
 */
export async function assertPublicHostname(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");

  // IP literal in the URL itself — validate directly, no DNS needed.
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) || host.includes(":")) {
    if (isPrivateOrReservedIp(host)) throw new Error("Endereço de destino não permitido.");
    return;
  }

  if (host === "localhost") throw new Error("Endereço de destino não permitido.");

  const resolved: string[] = [];
  try {
    const a = await Deno.resolveDns(host, "A");
    resolved.push(...a);
  } catch {
    // ignore — host may be AAAA-only
  }
  try {
    const aaaa = await Deno.resolveDns(host, "AAAA");
    resolved.push(...aaaa);
  } catch {
    // ignore — host may be A-only
  }

  if (resolved.length === 0) throw new Error("Não foi possível resolver o endereço de destino.");
  if (resolved.some((ip) => isPrivateOrReservedIp(ip))) {
    throw new Error("Endereço de destino não permitido.");
  }
}

export interface SsrfSafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  requireHttps?: boolean;
}

/**
 * Fetch wrapper for outbound requests to user/seller-controlled URLs.
 * - Validates protocol (https required by default).
 * - Resolves + validates the hostname against private/internal ranges.
 * - Never follows redirects (`redirect: "manual"`); any 3xx response is
 *   turned into a thrown error so callers treat it as a hard failure.
 */
export async function ssrfSafeFetch(rawUrl: string, options: SsrfSafeFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 10_000, requireHttps = true, ...init } = options;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL de destino inválida.");
  }
  if (requireHttps ? url.protocol !== "https:" : !["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL de destino deve usar HTTPS.");
  }

  await assertPublicHostname(url.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      ...init,
      redirect: "manual",
      signal: controller.signal,
    });
    if (res.status >= 300 && res.status < 400) {
      throw new Error("redirect não permitido");
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Z-API instanceId / instanceToken must match this to be used in a URL path segment. */
export const ZAPI_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
