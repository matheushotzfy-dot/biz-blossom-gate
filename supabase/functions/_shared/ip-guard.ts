// Lógica pura (sem Deno) para decidir se um IP é interno/reservado. Usada por ssrf.ts e testada no vitest.

// Faixas que nunca são destino legítimo de webhook/integração (formato [início, fim] inclusivo).
const IPV4_BLOCKED_RANGES: Array<[number, number]> = [
  [ipToInt("0.0.0.0"), ipToInt("0.255.255.255")],        // "esta rede"
  [ipToInt("10.0.0.0"), ipToInt("10.255.255.255")],      // privada
  [ipToInt("100.64.0.0"), ipToInt("100.127.255.255")],   // CGNAT
  [ipToInt("127.0.0.0"), ipToInt("127.255.255.255")],    // loopback
  [ipToInt("169.254.0.0"), ipToInt("169.254.255.255")],  // link-local (inclui metadados de nuvem 169.254.169.254)
  [ipToInt("172.16.0.0"), ipToInt("172.31.255.255")],    // privada
  [ipToInt("192.0.0.0"), ipToInt("192.0.0.255")],        // protocolo IETF
  [ipToInt("192.0.2.0"), ipToInt("192.0.2.255")],        // documentação
  [ipToInt("192.168.0.0"), ipToInt("192.168.255.255")],  // privada
  [ipToInt("198.18.0.0"), ipToInt("198.19.255.255")],    // benchmark
  [ipToInt("198.51.100.0"), ipToInt("198.51.100.255")],  // documentação
  [ipToInt("203.0.113.0"), ipToInt("203.0.113.255")],    // documentação
  [ipToInt("224.0.0.0"), ipToInt("255.255.255.255")],    // multicast + reservado + broadcast
];

function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return false;
  if (ip.split(".").some((part) => Number(part) > 255)) return true; // malformado: não arrisca
  const n = ipToInt(ip);
  return IPV4_BLOCKED_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

/** Converte um IPv6 em 8 grupos de 16 bits (aceita "::" e IPv4 no final). Devolve null se for inválido. */
function parseIPv6(ip: string): number[] | null {
  let text = ip.toLowerCase().split("%")[0];
  const v4 = text.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) {
    const parts = v4[1].split(".").map(Number);
    if (parts.some((part) => part > 255)) return null;
    text = text.slice(0, -v4[1].length) + ((parts[0] << 8) | parts[1]).toString(16) + ":" + ((parts[2] << 8) | parts[3]).toString(16);
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  const out = groups.map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : Number.NaN));
  return out.some(Number.isNaN) ? null : out;
}

const embeddedV4 = (high: number, low: number) => `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;

function isPrivateIPv6(ip: string): boolean {
  const g = parseIPv6(ip);
  if (!g) return true; // não deu para interpretar: bloqueia
  const allZeroUntil = (count: number) => g.slice(0, count).every((group) => group === 0);
  if (allZeroUntil(7) && (g[7] === 0 || g[7] === 1)) return true;                  // :: e ::1
  if (allZeroUntil(5) && g[5] === 0xffff) return isPrivateIPv4(embeddedV4(g[6], g[7])); // ::ffff:a.b.c.d (mapeado)
  if (allZeroUntil(6)) return isPrivateIPv4(embeddedV4(g[6], g[7]));                // ::a.b.c.d (compatível, obsoleto)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((group) => group === 0)) return isPrivateIPv4(embeddedV4(g[6], g[7])); // NAT64
  if (g[0] === 0x2002) return isPrivateIPv4(embeddedV4(g[1], g[2]));               // 6to4
  if ((g[0] & 0xfe00) === 0xfc00) return true;                                      // fc00::/7 única local
  if ((g[0] & 0xffc0) === 0xfe80) return true;                                      // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true;                                      // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true;                              // 2001:db8::/32 documentação
  return false;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  return ip.includes(":") ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}
