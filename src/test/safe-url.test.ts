import { afterEach, describe, expect, it, vi } from "vitest";
import { openExternal, safeNavigationUrl } from "@/lib/safeUrl";

describe("safeNavigationUrl", () => {
  it.each([
    ["https://hotzfy.com.br/pay/abc", "https://hotzfy.com.br/pay/abc"],
    ["http://exemplo.com/a?b=1", "http://exemplo.com/a?b=1"],
    ["  https://exemplo.com  ", "https://exemplo.com/"],
    ["/pay/abc", "https://app.exemplo.com/pay/abc"],
  ])("aceita %s", (input, expected) => expect(safeNavigationUrl(input, "https://app.exemplo.com")).toBe(expected));

  it.each([
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "java\nscript:alert(1)", "data:text/html,<script>1</script>", "vbscript:x",
    "blob:https://x.com/abc", "file:///etc/passwd", "//evil.com/x", "\\\\evil.com\\x", "https:\\\\evil.com", "", "   ", null, undefined,
  ])("recusa %s", (input) => expect(safeNavigationUrl(input as string, "https://app.exemplo.com")).toBeNull());
});

describe("openExternal", () => {
  afterEach(() => vi.restoreAllMocks());

  it("abre com noopener e noreferrer", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    expect(openExternal("https://exemplo.com/x")).toBe(true);
    expect(open).toHaveBeenCalledWith("https://exemplo.com/x", "_blank", "noopener,noreferrer");
  });

  it("não abre nada perigoso", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    expect(openExternal("javascript:alert(document.cookie)")).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});
