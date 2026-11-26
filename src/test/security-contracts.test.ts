import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Regras de segurança que dependem de NÃO voltar a escrever um certo código. Lê os arquivos do projeto. */
const ROOT = join(__dirname, "..", "..");
function files(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "test" || name === "__preview__") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, ext, out);
    else if (ext.test(name)) out.push(path);
  }
  return out;
}
const source = files(join(ROOT, "src"), /\.(ts|tsx)$/).map((path) => ({ path, text: readFileSync(path, "utf8") }));
const migrations = readdirSync(join(ROOT, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
const lastMigrationWith = (needle: RegExp) => {
  const hit = [...migrations].reverse().find((f) => needle.test(readFileSync(join(ROOT, "supabase", "migrations", f), "utf8")));
  return hit ? readFileSync(join(ROOT, "supabase", "migrations", hit), "utf8") : "";
};

describe("contratos de segurança", () => {
  it("observação interna do admin não volta para profiles (o seller lê a própria linha inteira)", () => {
    const offenders = source.filter((f) => /from\("profiles"\)\s*\.update\(\{[^}]*admin_notes/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
    expect(lastMigrationWith(/seller_admin_notes/)).toMatch(/trg_zz_clear_profile_admin_notes/);
  });

  it("os pixels do checkout saem de uma view que o visitante consegue ler, sem token", () => {
    const sql = lastMigrationWith(/VIEW public\.product_pixels_public/);
    const view = sql.split("VIEW public.product_pixels_public")[1]?.split(";")[0] ?? "";
    expect(view).toMatch(/security_invoker = false/);
    expect(view).not.toMatch(/api_token/);
    expect(view).toMatch(/is_product_active\(product_id\)/);
  });

  it("nenhum número de WhatsApp de mentira no painel", () => {
    const offenders = source.filter((f) => /wa\.me\/55119{6,}/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("order bump só do mesmo dono, nunca o próprio produto e no máximo 5", () => {
    const sql = lastMigrationWith(/guard_order_bump/);
    expect(sql).toMatch(/order_bump_not_owner/);
    expect(sql).toMatch(/order_bump_self/);
    expect(sql).toMatch(/_count >= 5/);
  });
});
