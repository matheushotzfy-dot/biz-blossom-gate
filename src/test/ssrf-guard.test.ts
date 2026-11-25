import { describe, expect, it } from "vitest";
import { isPrivateOrReservedIp } from "../../supabase/functions/_shared/ip-guard";

describe("guard de SSRF (destinos de webhook e integrações)", () => {
  it.each([
    "127.0.0.1", "127.8.8.8", "10.0.0.5", "172.16.0.1", "172.31.255.254", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "192.0.0.8", "198.18.0.1", "224.0.0.1", "239.255.255.250", "255.255.255.255", "240.0.0.1",
  ])("bloqueia IPv4 interno ou reservado %s", (ip) => expect(isPrivateOrReservedIp(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "191.252.0.1", "200.147.67.142", "100.63.255.255", "100.128.0.1"])(
    "libera IPv4 público %s", (ip) => expect(isPrivateOrReservedIp(ip)).toBe(false));

  it.each([
    "::", "::1", "0:0:0:0:0:0:0:1", "fe80::1", "febf::1", "fc00::1", "fd12:3456::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:169.254.169.254", "::ffff:a9fe:a9fe", "::ffff:0a00:0001",
    "::127.0.0.1", "64:ff9b::7f00:1", "64:ff9b::169.254.169.254", "2002:7f00:1::1", "2001:db8::1",
  ])("bloqueia IPv6 interno, reservado ou que embute IPv4 interno %s", (ip) => expect(isPrivateOrReservedIp(ip)).toBe(true));

  it.each(["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "::ffff:0808:0808", "64:ff9b::808:808"])(
    "libera IPv6 público %s", (ip) => expect(isPrivateOrReservedIp(ip)).toBe(false));

  it("na dúvida, bloqueia (IPv6 malformado ou IPv4 fora de faixa)", () => {
    for (const ip of ["::1::2", "gggg::1", "1:2:3:4:5:6:7", "1:2:3:4:5:6:7:8:9", "999.1.1.1"]) expect(isPrivateOrReservedIp(ip)).toBe(true);
  });
});
