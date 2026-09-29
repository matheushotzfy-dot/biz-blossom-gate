import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, preflight, safeError } from "../_shared/security.ts";

function pathFromStoredUrl(value: string | null, bucket: string): string | null {
  if (!value) return null;
  if (!value.includes("/storage/v1/object/")) return value.replace(/^\/+/, "");
  const marker = `/${bucket}/`;
  const index = value.indexOf(marker);
  return index >= 0 ? decodeURIComponent(value.slice(index + marker.length).split("?")[0]) : null;
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "GET") return json(req, { success: false, error: "Método não permitido" }, 405);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(req, { success: false, error: "Não autorizado" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(authHeader.slice(7));
    if (claimsError || !claims?.claims?.sub) return json(req, { success: false, error: "Não autorizado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: races, error: raceError } = await admin.from("revenue_races").select("id, banner_url, logo_url").eq("is_active", true).order("starts_at", { ascending: false }).limit(1);
    if (raceError) throw raceError;
    const race = races?.[0];
    if (!race) return json(req, { success: true, race_id: null, urls: {} });
    const { data: prizes, error: prizeError } = await admin.from("revenue_race_prizes").select("id, image_url").eq("race_id", race.id);
    if (prizeError) throw prizeError;

    const entries: Array<[string, string]> = [];
    const banner = pathFromStoredUrl(race.banner_url, "race-assets");
    const logo = pathFromStoredUrl(race.logo_url, "race-assets");
    if (banner?.startsWith(`${race.id}/`)) entries.push(["banner", banner]);
    if (logo?.startsWith(`${race.id}/`)) entries.push(["logo", logo]);
    for (const prize of prizes ?? []) {
      const path = pathFromStoredUrl(prize.image_url, "race-assets");
      if (path?.startsWith(`${race.id}/`)) entries.push([`prize:${prize.id}`, path]);
    }
    const urls: Record<string, string> = {};
    await Promise.all(entries.map(async ([key, path]) => {
      const { data } = await admin.storage.from("race-assets").createSignedUrl(path, 900);
      if (data?.signedUrl) urls[key] = data.signedUrl;
    }));
    return json(req, { success: true, race_id: race.id, expires_in: 900, urls });
  } catch (error) {
    safeError("get-race-asset-urls", error);
    return json(req, { success: false, error: "Não foi possível carregar as imagens da corrida" }, 500);
  }
});