/** Utms e códigos de origem que o checkout guardou no endereço de onde a venda veio. */
export function trackingParams(source: string | null | undefined): Array<[string, string]> {
  if (!source?.startsWith("http")) return [];
  try {
    const url = new URL(source);
    return ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "sck"]
      .map((key) => [key, url.searchParams.get(key)] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1]));
  } catch { return []; }
}
