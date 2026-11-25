import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SecretDialog, KeyNameDialog } from "@/components/integrations/KeyDialogs";
import { KeyList } from "@/components/integrations/KeyList";
import { KeyRing } from "@/components/integrations/KeyRing";
import { dateShort, keyAttention, keyLife, nextKeyName, type ApiKeyRow } from "@/components/integrations/intMeta";

vi.mock("@/components/seller-ui/copy", () => ({ copyText: vi.fn(async () => true) }));

const NOW = new Date("2026-11-24T12:00:00Z").getTime();
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();
const key = (over: Partial<ApiKeyRow> = {}): ApiKeyRow => ({
  id: "k1", name: "Produção", public_key: "pk_live_Qw8ErTyUiOpAsDfGhJkLzXcVbNm12345", secret_key_prefix: "sk_live_Hk3Lp", is_active: true,
  created_at: day(-30), last_used_at: null, expires_at: day(60), revoked_at: null, ...over,
});

describe("keyLife", () => {
  it("é a fração da validade que resta e os dias inteiros", () => {
    const l = keyLife(key({ created_at: day(-30), expires_at: day(60) }), NOW);
    expect(l.days).toBe(60);
    expect(l.fraction).toBeCloseTo(60 / 90, 3);
  });
  it("vencida zera; sem validade fica cheia e sem contagem", () => {
    expect(keyLife(key({ expires_at: day(-3) }), NOW)).toEqual({ fraction: 0, days: 0 });
    expect(keyLife(key({ expires_at: null }), NOW)).toEqual({ fraction: 1, days: null });
  });
  it("nunca passa de 1, mesmo com validade maior que o previsto", () => {
    expect(keyLife(key({ created_at: day(1), expires_at: day(91) }), NOW).fraction).toBe(1);
  });
});

describe("keyAttention", () => {
  it("pede troca quando vence em até 14 dias ou já venceu", () => {
    expect(keyAttention(key({ expires_at: day(14) }), NOW)).toBe("soon");
    expect(keyAttention(key({ expires_at: day(15) }), NOW)).toBeNull();
    expect(keyAttention(key({ expires_at: day(-1) }), NOW)).toBe("expired");
  });
  it("pausada e revogada não pedem nada enquanto não vencem", () => {
    expect(keyAttention(key({ is_active: false, expires_at: day(3) }), NOW)).toBeNull();
    expect(keyAttention(key({ revoked_at: day(-1), is_active: false, expires_at: day(3) }), NOW)).toBeNull();
  });
});

describe("nextKeyName", () => {
  it("numera a partir de 2 e não repete nome", () => {
    expect(nextKeyName("Produção", ["Produção"])).toBe("Produção 2");
    expect(nextKeyName("Produção", ["Produção", "produção 2"])).toBe("Produção 3");
  });
  it("troca o número em vez de empilhar", () => {
    expect(nextKeyName("Loja 2", ["Loja 2"])).toBe("Loja 3");
    expect(nextKeyName("Loja (nova)", ["Loja"])).toBe("Loja 2");
  });
  it("respeita o limite de 100 caracteres", () => {
    expect(nextKeyName("x".repeat(100), []).length).toBeLessThanOrEqual(100);
  });
});

describe("dateShort", () => {
  it("escreve dia, mês e ano no horário de Brasília", () => {
    expect(dateShort("2027-01-18T12:00:00Z")).toBe("18 jan 2027");
    expect(dateShort("2026-09-02T02:00:00Z")).toBe("1 set 2026");
  });
});

describe("KeyRing", () => {
  it("fala os dias que faltam", () => {
    render(<KeyRing k={key({ expires_at: day(55) })} state="active" now={NOW} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Faltam 55 dias para a chave expirar");
  });
  it("diz quando a chave foi revogada ou expirou", () => {
    const { rerender } = render(<KeyRing k={key()} state="revoked" now={NOW} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Chave revogada");
    rerender(<KeyRing k={key({ expires_at: day(-2) })} state="expired" now={NOW} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Chave expirada");
  });
});

const handlers = () => ({ onCopy: vi.fn(), onRename: vi.fn(), onSwap: vi.fn(), onToggle: vi.fn(), onRevoke: vi.fn(), onDelete: vi.fn(), onDismissSwap: vi.fn() });

describe("KeyList", () => {
  it("mostra o aviso de troca em chave que vence logo e chama onSwap", () => {
    const h = handlers();
    const k = key({ expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(), created_at: new Date(Date.now() - 85 * 86_400_000).toISOString() });
    render(<KeyList keys={[k]} busyId={null} swapId={null} {...h} />);
    expect(screen.getByText(/vence logo/)).toBeTruthy();
    fireEvent.click(screen.getByText("Trocar chave"));
    expect(h.onSwap).toHaveBeenCalledWith(k);
  });
  it("depois da troca, a chave antiga pergunta se já pode revogar", () => {
    const h = handlers();
    const k = key();
    render(<KeyList keys={[k]} busyId={null} swapId="k1" {...h} />);
    expect(screen.getByText(/A chave nova já existe/)).toBeTruthy();
    fireEvent.click(screen.getByText("Revogar esta"));
    expect(h.onRevoke).toHaveBeenCalledWith(k);
    fireEvent.click(screen.getByText("Depois"));
    expect(h.onDismissSwap).toHaveBeenCalled();
  });
  it("copia a chave pública pelo chip", () => {
    const h = handlers();
    const k = key();
    render(<KeyList keys={[k]} busyId={null} swapId={null} {...h} />);
    fireEvent.click(screen.getByLabelText("Copiar a chave pública de Produção"));
    expect(h.onCopy).toHaveBeenCalledWith(k);
  });
  it("não oferece troca nem aviso em chave revogada", () => {
    const h = handlers();
    render(<KeyList keys={[key({ revoked_at: day(-1), is_active: false, expires_at: day(-2) })]} busyId={null} swapId="k1" {...h} />);
    expect(screen.queryByText("Trocar chave")).toBeNull();
    expect(screen.queryByText(/A chave nova já existe/)).toBeNull();
    expect(screen.getByText("Revogada")).toBeTruthy();
  });
});

describe("SecretDialog", () => {
  const value = { name: "Produção 2", public_key: "pk_live_abc", secret_key: "sk_live_9aZxQ2mN4pL7", replaces: "Produção" };

  it("fechar sem copiar pede uma segunda confirmação", () => {
    const onClose = vi.fn();
    render(<SecretDialog value={value} onClose={onClose} />);
    fireEvent.click(screen.getByText("Já guardei a chave"));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/ainda não copiou/);
    fireEvent.click(screen.getByText("Fechar mesmo assim"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("depois de copiar, fecha de primeira", async () => {
    const onClose = vi.fn();
    render(<SecretDialog value={value} onClose={onClose} />);
    fireEvent.click(screen.getAllByText("Copiar")[0]);
    await screen.findByText("Copiada");
    fireEvent.click(screen.getByText("Já guardei a chave"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("avisa qual chave esta substitui e mostra a secreta inteira", () => {
    render(<SecretDialog value={value} onClose={() => {}} />);
    expect(screen.getByText(/substitui/).textContent).toContain("Produção");
    expect(document.getElementById("secret-key")?.textContent).toBe("sk_live_9aZxQ2mN4pL7");
  });
});

describe("KeyNameDialog", () => {
  it("avisa nome repetido sem bloquear", async () => {
    const onSave = vi.fn(async () => ({ ok: true }));
    render(<KeyNameDialog target={{ mode: "create", name: "Loja" }} taken={["loja"]} onOpenChange={() => {}} onSave={onSave} />);
    expect(screen.getByText(/Já existe uma chave com esse nome/)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByText("Criar chave")); });
    expect(onSave).toHaveBeenCalledWith("Loja");
  });
  it("no modo trocar, mostra de qual chave vem e o texto do botão", () => {
    render(<KeyNameDialog target={{ mode: "replace", name: "Produção 2", from: "Produção" }} onOpenChange={() => {}} onSave={async () => ({ ok: true })} />);
    expect(screen.getByText('Substitui "Produção"')).toBeTruthy();
    expect(screen.getByText("Criar chave nova")).toBeTruthy();
  });
  it("não deixa salvar nome vazio", () => {
    const onSave = vi.fn(async () => ({ ok: true }));
    render(<KeyNameDialog target={{ mode: "rename", name: "" }} onOpenChange={() => {}} onSave={onSave} />);
    fireEvent.click(screen.getByText("Salvar nome"));
    expect(screen.getByRole("alert").textContent).toBe("Dê um nome para a chave.");
    expect(onSave).not.toHaveBeenCalled();
  });
});
