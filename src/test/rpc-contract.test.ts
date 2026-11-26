import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Contrato entre o código e o banco: toda chamada `supabase.rpc("nome", { ... })` precisa usar uma função que
 * existe (nas migrações ou em `types.ts`), com exatamente os nomes de parâmetro dela e sem esquecer nenhum
 * obrigatório. Sem isso o botão "salva", mas o banco responde erro (ou ignora o campo).
 *
 * As migrações são a fonte principal; `types.ts` cobre o que o banco tem e as migrações não (3 funções de KYC
 * foram criadas fora do repositório). A mesma checagem foi conferida contra o banco de produção em 2026-11-26.
 */

const ROOT = join(__dirname, "..");
const MIGRATIONS = join(ROOT, "..", "supabase", "migrations");
const TYPES = readFileSync(join(ROOT, "integrations/supabase/types.ts"), "utf8");

type Param = { name: string; optional: boolean };
type Sig = Param[];

function splitTop(raw: string): string[] {
  const parts: string[] = [];
  let depth = 0; let cur = "";
  for (const ch of raw) {
    if ("({[".includes(ch)) depth += 1;
    else if (")}]".includes(ch)) depth -= 1;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function balanced(text: string, from: number): { body: string; end: number } {
  let depth = 1; let j = from;
  while (j < text.length && depth > 0) {
    if (text[j] === "(") depth += 1;
    else if (text[j] === ")") depth -= 1;
    j += 1;
  }
  return { body: text.slice(from, j - 1), end: j };
}

/** Funções de `public` criadas nas migrações (em ordem), respeitando DROP FUNCTION. */
function functionsFromMigrations(): Map<string, Sig[]> {
  const out = new Map<string, Sig[]>();
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  const create = /create\s+(?:or\s+replace\s+)?function\s+(?:(\w+)\.)?"?([a-z_0-9]+)"?\s*\(/gi;
  const drop = /drop\s+function\s+(?:if\s+exists\s+)?(?:(\w+)\.)?"?([a-z_0-9]+)"?\s*\(/gi;
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");
    const events: { at: number; kind: "create" | "drop"; schema?: string; name: string; body: string }[] = [];
    for (let m = create.exec(sql); m; m = create.exec(sql)) events.push({ at: m.index, kind: "create", schema: m[1], name: m[2], body: balanced(sql, m.index + m[0].length).body });
    for (let m = drop.exec(sql); m; m = drop.exec(sql)) events.push({ at: m.index, kind: "drop", schema: m[1], name: m[2], body: balanced(sql, m.index + m[0].length).body });
    events.sort((a, b) => a.at - b.at);
    for (const e of events) {
      if (e.schema && e.schema.toLowerCase() !== "public") continue;
      const params: Sig = splitTop(e.body)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const clean = p.replace(/^(in|out|inout|variadic)\s+/i, "");
          const m = /^"?([a-z_0-9]+)"?\s+([\s\S]+)$/i.exec(clean);
          return m ? { name: m[1], optional: /\bdefault\b|:=|\s=\s/i.test(m[2]) } : null;
        })
        .filter((p): p is Param => p !== null);
      const list = (out.get(e.name) ?? []).filter((s) => s.length !== params.length);
      if (e.kind === "create") list.push(params);
      if (list.length) out.set(e.name, list); else out.delete(e.name);
    }
  }
  return out;
}

/** Funções do `types.ts` (gerado a partir do banco). */
function functionsFromTypes(): Map<string, Sig[]> {
  const start = TYPES.indexOf("    Functions: {");
  const end = TYPES.indexOf("    Enums: {", start);
  const block = TYPES.slice(start, end);
  const out = new Map<string, Sig[]>();
  const head = /^ {6}([a-z_0-9]+): \{/gm;
  const heads: { name: string; index: number }[] = [];
  for (let m = head.exec(block); m; m = head.exec(block)) heads.push({ name: m[1], index: m.index });
  heads.forEach((h, i) => {
    const chunk = block.slice(h.index, heads[i + 1]?.index ?? block.length);
    const rest = chunk.slice(chunk.indexOf("Args:") + 5).trimStart();
    if (rest.startsWith("never")) { out.set(h.name, [[]]); return; }
    let depth = 0; let j = 0;
    for (; j < rest.length; j += 1) {
      if (rest[j] === "{") depth += 1;
      if (rest[j] === "}") { depth -= 1; if (depth === 0) break; }
    }
    const body = rest.slice(1, j);
    out.set(h.name, [[...body.matchAll(/(?:^|\n|\{|,|;)\s*([A-Za-z_0-9]+)(\?)?:/g)].map((m) => ({ name: m[1], optional: Boolean(m[2]) }))]);
  });
  return out;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (["test", "__preview__"].includes(entry)) continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) && !full.endsWith("integrations/supabase/types.ts")) acc.push(full);
  }
  return acc;
}

/** Chaves de primeiro nível de um objeto literal; `null` quando há spread (não dá para checar). */
function topKeys(literal: string): string[] | null {
  const keys: string[] = [];
  for (const p of splitTop(literal.trim().slice(1, -1))) {
    const t = p.trim();
    if (!t) continue;
    if (t.startsWith("...")) return null;
    const m = /^["']?([A-Za-z_0-9]+)["']?\s*(?::|$)/.exec(t);
    if (m) keys.push(m[1]);
  }
  return keys;
}

const CALL = /\.rpc\(\s*["'`]([a-z_0-9]+)["'`]\s*(?:as never\s*)?(?:,\s*(\{[\s\S]*?\})\s*(?:as never)?\s*)?\)/g;

describe("contrato código ↔ banco (supabase.rpc)", () => {
  const fromMigrations = functionsFromMigrations();
  const fromTypes = functionsFromTypes();
  const known = (name: string): Sig[] => [...(fromMigrations.get(name) ?? []), ...(fromTypes.get(name) ?? [])];

  const calls: { where: string; name: string; keys: string[] | null }[] = [];
  for (const file of walk(ROOT)) {
    const src = readFileSync(file, "utf8");
    for (let m = CALL.exec(src); m; m = CALL.exec(src)) {
      const lineStart = src.lastIndexOf("\n", m.index) + 1;
      const before = src.slice(lineStart, m.index);
      if (/\/\/|^\s*\*/.test(before)) continue; // menção em comentário
      const line = src.slice(0, m.index).split("\n").length;
      calls.push({ where: `${relative(ROOT, file)}:${line}`, name: m[1], keys: m[2] ? topKeys(m[2]) : [] });
    }
  }

  it("lê as funções e as chamadas (sanidade do próprio teste)", () => {
    expect(fromMigrations.size).toBeGreaterThan(300);
    expect(calls.length).toBeGreaterThan(120);
  });

  it("toda função chamada existe no banco", () => {
    const missing = calls.filter((c) => known(c.name).length === 0).map((c) => `${c.where} → ${c.name}`);
    expect(missing).toEqual([]);
  });

  it("os parâmetros batem: nenhum a mais e nenhum obrigatório faltando", () => {
    const problems: string[] = [];
    for (const c of calls) {
      const sigs = known(c.name);
      if (!sigs.length || c.keys === null) continue;
      const keys = c.keys;
      const fits = sigs.some((sig) => keys.every((k) => sig.some((p) => p.name === k)) && sig.every((p) => p.optional || keys.includes(p.name)));
      if (!fits) problems.push(`${c.where} ${c.name}: chamada [${keys}] não bate com [${sigs.map((s) => s.map((p) => p.name + (p.optional ? "?" : "")).join(",")).join(" | ")}]`);
    }
    expect(problems).toEqual([]);
  });
});
