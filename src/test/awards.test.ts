import { describe, expect, it } from "vitest";
import {
  CLAIM_STEPS, claimHeadline, claimStepIndex, nextAward, pieceState, railFraction, segmentPercent, spokenBRL, sumPaged, toCents,
  type RewardClaim,
} from "@/features/awards/awardMeta";
import { AWARDS } from "@/features/awards/awards-data";
import { mergeTiers, type TierRow } from "@/features/awards/use-awards";
import { claimErrorMessage, EMPTY_CLAIM, isValidPhone, maskCep, normalizeClaim, validateClaim, type ClaimForm } from "@/features/awards/claimForm";

const claim = (o: Partial<RewardClaim>): RewardClaim => ({ id: "c", tier_id: "100k", tier_label: "Placa", status: "pending", created_at: "2026-11-01T10:00:00Z", ...o });
const VALUES = AWARDS.map((a) => a.value);

describe("etapas do resgate", () => {
  it("usa as mesmas etapas do admin", () => {
    expect(CLAIM_STEPS.map((s) => s.id)).toEqual(["pending", "preparing", "shipped", "delivered"]);
  });
  it("preparing avança a trilha (antes caía em análise)", () => {
    expect(claimStepIndex("pending")).toBe(0);
    expect(claimStepIndex("preparing")).toBe(1);
    expect(claimStepIndex("approved")).toBe(1);
    expect(claimStepIndex("shipped")).toBe(2);
    expect(claimStepIndex("delivered")).toBe(3);
    expect(claimStepIndex("algo-novo")).toBe(0);
  });
  it("frases por etapa", () => {
    expect(claimHeadline({ status: "preparing", tracking_code: null })).toMatch(/preparada/);
    expect(claimHeadline({ status: "shipped", tracking_code: "BR123" })).toBe("Sua peça foi postada");
    expect(claimHeadline({ status: "shipped", tracking_code: null })).toMatch(/rastreio/);
    expect(claimHeadline({ status: "cancelled", tracking_code: null })).toBe("Resgate cancelado");
  });
});

describe("estado de cada peça", () => {
  const a = AWARDS.find((x) => x.id === "100k")!;
  it("selada, pronta, em andamento, entregue e cancelada", () => {
    expect(pieceState(a, 99_999.99, []).kind).toBe("sealed");
    expect(pieceState(a, 100_000, []).kind).toBe("ready");
    expect(pieceState(a, 150_000, [claim({ status: "shipped" })]).kind).toBe("active");
    expect(pieceState(a, 150_000, [claim({ status: "delivered" })]).kind).toBe("delivered");
    expect(pieceState(a, 150_000, [claim({ status: "cancelled" })]).kind).toBe("cancelled");
  });
  it("resgate cancelado não libera um novo (o banco barra)", () => {
    expect(pieceState(a, 500_000, [claim({ status: "cancelled" })]).kind).not.toBe("ready");
  });
  it("ignora resgates de outras peças", () => {
    expect(pieceState(a, 150_000, [claim({ tier_id: "250k", status: "shipped" })]).kind).toBe("ready");
  });
  it("prefere o resgate ativo ao cancelado mais antigo ou mais novo", () => {
    const list = [claim({ id: "1", status: "cancelled", created_at: "2026-11-03T10:00:00Z" }), claim({ id: "2", status: "preparing", created_at: "2026-11-02T10:00:00Z" })];
    expect(pieceState(a, 200_000, list).claim?.id).toBe("2");
  });
});

describe("trilha da jornada", () => {
  it("zero sem faturamento e cheia depois da última peça", () => {
    expect(railFraction(VALUES, 0)).toBe(0);
    expect(railFraction(VALUES, 10_000_000)).toBe(1);
    expect(railFraction(VALUES, 99_000_000)).toBe(1);
    expect(railFraction([], 500)).toBe(0);
  });
  it("cada peça ocupa o mesmo trecho", () => {
    const n = VALUES.length;
    expect(railFraction(VALUES, 10_000)).toBeCloseTo(1 / n);
    expect(railFraction(VALUES, 100_000)).toBeCloseTo(2 / n);
    expect(railFraction(VALUES, 55_000)).toBeCloseTo(1.5 / n);
    expect(railFraction(VALUES, 5_000)).toBeCloseTo(0.5 / n);
  });
  it("sempre cresce com o faturamento", () => {
    let last = -1;
    for (const r of [0, 1, 9_999, 10_000, 50_000, 100_000, 300_000, 750_000, 1_000_000, 4_999_999, 7_000_000, 10_000_000]) {
      const f = railFraction(VALUES, r);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
  });
  it("próxima peça e percentual do trecho", () => {
    expect(nextAward(AWARDS, 0)?.id).toBe("10k");
    expect(nextAward(AWARDS, 100_000)?.id).toBe("250k");
    expect(nextAward(AWARDS, 10_000_000)).toBeNull();
    expect(segmentPercent(AWARDS, 0)).toBe(0);
    expect(segmentPercent(AWARDS, 5_000)).toBe(50);
    expect(segmentPercent(AWARDS, 175_000)).toBe(50);
    expect(segmentPercent(AWARDS, 20_000_000)).toBe(100);
  });
  it("texto falado", () => {
    expect(spokenBRL(10_000)).toBe("R$ 10 mil");
    expect(spokenBRL(250_000)).toBe("R$ 250 mil");
    expect(spokenBRL(1_000_000)).toBe("R$ 1 milhão");
    expect(spokenBRL(5_000_000)).toBe("R$ 5 milhões");
    expect(spokenBRL(1_500_000)).toBe("R$ 1,5 milhão");
  });
});

describe("faturamento paginado", () => {
  it("soma em centavos sem erro de ponto flutuante", () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(30);
    expect(toCents("19.9")).toBe(1990);
    expect(toCents(null)).toBe(0);
    expect(toCents("abc")).toBe(0);
  });
  it("lê todas as páginas, não só as primeiras 1.000 linhas", async () => {
    const rows = Array.from({ length: 2_350 }, () => ({ net_amount: 10.1 }));
    const calls: number[] = [];
    const out = await sumPaged(async (from, to) => { calls.push(from); return { data: rows.slice(from, to + 1), error: null }; }, 1000);
    expect(calls).toEqual([0, 1000, 2000]);
    expect(out).toEqual({ total: 23_735, capped: false });
  });
  it("página cheia seguida de página vazia termina", async () => {
    const rows = Array.from({ length: 1000 }, () => ({ net_amount: 1 }));
    const out = await sumPaged(async (from) => ({ data: from === 0 ? rows : [], error: null }), 1000);
    expect(out.total).toBe(1000);
  });
  it("propaga erro em vez de mostrar um total parcial", async () => {
    await expect(sumPaged(async () => ({ data: null, error: new Error("x") }))).rejects.toThrow("x");
  });
  it("avisa quando bate o limite de páginas", async () => {
    const out = await sumPaged(async () => ({ data: [{ net_amount: 1 }, { net_amount: 1 }], error: null }), 2, 3);
    expect(out).toEqual({ total: 6, capped: true });
  });
});

describe("peças do admin", () => {
  const row = (o: Partial<TierRow>): TierRow => ({ id: "100k", title: "Placa X", tier: "Bronze", value: 100_000, description: "", phrase: "", rewards: [], image_url: null, sort_order: 1, is_active: true, ...o });
  it("sem linhas usa as padrão", () => {
    expect(mergeTiers([])).toBe(AWARDS);
    expect(mergeTiers(null)).toBe(AWARDS);
  });
  it("todas desativadas resulta em nenhuma peça", () => {
    expect(mergeTiers([row({ is_active: false })])).toEqual([]);
  });
  it("mantém a arte padrão e usa o texto do admin", () => {
    const [a] = mergeTiers([row({ title: "Placa 100 MIL especial", description: "Texto do admin" })]);
    expect(a.title).toBe("Placa 100 MIL especial");
    expect(a.description).toBe("Texto do admin");
    expect(a.image).toBe(AWARDS.find((x) => x.id === "100k")!.image);
    expect(a.custom).toBe(false);
  });
  it("peça nova sem imagem não empresta a arte de outro valor", () => {
    const [a] = mergeTiers([row({ id: "300k", value: 300_000 })]);
    expect(a.image).toBeNull();
    expect(a.label).toBe("R$ 300K");
    expect(a.reference).toBe("VNX-300K");
  });
  it("ordena por ordem e valor e marca imagem enviada", () => {
    const list = mergeTiers([row({ id: "b", value: 2_000, sort_order: 2, image_url: "https://x/y.png" }), row({ id: "a", value: 1_000, sort_order: 1 })]);
    expect(list.map((x) => x.id)).toEqual(["a", "b"]);
    expect(list[1].custom).toBe(true);
    expect(list.map((x) => x.roman)).toEqual(["I", "II"]);
  });
  it("brilho do palco acompanha o metal da peça", () => {
    expect(AWARDS.find((a) => a.id === "10m")!.glow).toMatch(/^42 /);
    expect(AWARDS.find((a) => a.id === "5m")!.glow).toMatch(/^200 /);
  });
});

describe("formulário de resgate", () => {
  const ok: ClaimForm = {
    recipient_name: "Lucker Silva", phone: "(44) 99999-0000", document: "", shipping_zip: "87020-025", shipping_street: "Av. Brasil",
    shipping_number: "100", shipping_complement: "", shipping_neighborhood: "Zona 01", shipping_city: "Maringá", shipping_state: "PR",
  };
  it("formulário completo não tem erros", () => {
    expect(validateClaim(ok)).toEqual({});
  });
  it("vazio aponta todos os campos obrigatórios", () => {
    expect(Object.keys(validateClaim(EMPTY_CLAIM)).sort()).toEqual(["phone", "recipient_name", "shipping_city", "shipping_neighborhood", "shipping_number", "shipping_state", "shipping_street", "shipping_zip"]);
  });
  it("pede nome e sobrenome", () => {
    expect(validateClaim({ ...ok, recipient_name: "Lucker" }).recipient_name).toMatch(/sobrenome/);
    expect(validateClaim({ ...ok, recipient_name: "  Lucker   Silva " }).recipient_name).toBeUndefined();
  });
  it("telefone com DDD, celular com 9", () => {
    expect(isValidPhone("(44) 99999-0000")).toBe(true);
    expect(isValidPhone("4433334444")).toBe(true);
    expect(isValidPhone("+55 44 99999-0000")).toBe(true);
    expect(isValidPhone("(44) 89999-0000")).toBe(false);
    expect(isValidPhone("99999-0000")).toBe(false);
    expect(isValidPhone("(05) 99999-0000")).toBe(false);
  });
  it("documento é opcional, mas se vier tem que ser válido", () => {
    expect(validateClaim({ ...ok, document: "529.982.247-25" }).document).toBeUndefined();
    expect(validateClaim({ ...ok, document: "111.111.111-11" }).document).toBe("CPF ou CNPJ inválido.");
    expect(validateClaim({ ...ok, document: "123" }).document).toBe("CPF ou CNPJ inválido.");
    expect(validateClaim({ ...ok, document: "11.222.333/0001-81" }).document).toBeUndefined();
  });
  it("CEP e estado", () => {
    expect(maskCep("87020025")).toBe("87020-025");
    expect(maskCep("8702")).toBe("8702");
    expect(validateClaim({ ...ok, shipping_zip: "8702" }).shipping_zip).toBeDefined();
    expect(validateClaim({ ...ok, shipping_state: "XX" }).shipping_state).toBeDefined();
    expect(validateClaim({ ...ok, shipping_state: "pr" }).shipping_state).toBeUndefined();
  });
  it("normaliza o que vai para o banco", () => {
    const n = normalizeClaim({ ...ok, recipient_name: "  Lucker   Silva ", phone: "44999990000", document: "52998224725", shipping_zip: "87020025", shipping_state: "pr", shipping_complement: "  " });
    expect(n).toMatchObject({ recipient_name: "Lucker Silva", phone: "(44) 99999-0000", document: "529.982.247-25", shipping_zip: "87020-025", shipping_state: "PR", shipping_complement: null });
  });
  it("traduz os erros do banco", () => {
    expect(claimErrorMessage({ message: "reward_already_claimed" })).toMatch(/já foi solicitada/);
    expect(claimErrorMessage({ code: "42501", message: "new row violates row-level security policy" })).toMatch(/suporte/);
    expect(claimErrorMessage({ message: "Failed to fetch" })).toMatch(/Não foi possível/);
    expect(claimErrorMessage(null)).toMatch(/Não foi possível/);
  });
});
