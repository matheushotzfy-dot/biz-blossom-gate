import { ArrowDownLeft, Check, GraduationCap, KeyRound, Play, RefreshCw, Timer, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** O "V" da marca desenhado como um check, para marcar cada etapa. */
export function CheckMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className={className ?? "h-[18px] w-[18px]"}>
      <path d="M14 29 L28 46 L50 15" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** QR de enfeite: três marcadores nos cantos e miolo fixo, nunca um código real. */
const QR_SIZE = 11;
function qrCells(): boolean[] {
  const cells: boolean[] = [];
  let seed = 7;
  const finder = (r: number, c: number) => {
    const inBox = (r0: number, c0: number) => r >= r0 && r < r0 + 3 && c >= c0 && c < c0 + 3;
    if (inBox(0, 0) || inBox(0, QR_SIZE - 3) || inBox(QR_SIZE - 3, 0)) return true;
    return false;
  };
  for (let r = 0; r < QR_SIZE; r++) {
    for (let c = 0; c < QR_SIZE; c++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const nearCorner = (r < 4 && (c < 4 || c > QR_SIZE - 5)) || (r > QR_SIZE - 5 && c < 4);
      cells.push(finder(r, c) || (!nearCorner && seed % 100 < 48));
    }
  }
  return cells;
}
const QR = qrCells();

export function CheckoutSpecimen() {
  return (
    <div className="lp-spec w-full max-w-[480px]">
      <div className="flex items-center gap-3.5 p-5 pb-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-primary text-primary-foreground"><GraduationCap className="h-6 w-6" /></span>
        <span className="min-w-0">
          <span className="block truncate text-[15.5px] font-extrabold leading-tight text-foreground">Curso Marketing do Zero</span>
          <span className="block text-[13px] text-muted-foreground">Acesso liberado por e-mail</span>
        </span>
      </div>
      <div className="px-5 pb-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13.5px] font-semibold text-muted-foreground">Total</span>
          <span className="text-[1.7rem] font-extrabold tracking-[-0.035em] tabular-nums text-foreground">R$ 197,00</span>
        </div>
        <div className="lp-seg mt-4"><span data-on="true">Pix</span><span>Cartão</span><span>Boleto</span></div>
        <div className="mt-4 flex flex-col items-start gap-3 min-[430px]:flex-row min-[430px]:items-center min-[430px]:gap-4">
          <div className="lp-qr shrink-0">{QR.map((on, i) => <i key={i} data-on={on ? "1" : "0"} />)}</div>
          <p className="text-[13px] leading-snug text-muted-foreground">Escaneie o QR Code ou copie o código. A confirmação chega sozinha, sem mandar comprovante.</p>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-muted px-3.5 py-3">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[6px] bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" strokeWidth={3.5} /></span>
          <span className="text-[13px] font-semibold leading-snug text-foreground">Levar também a planilha de metas por R$ 27,00</span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-[14px] bg-accent px-3.5 py-2.5 text-[13px] font-bold text-accent-foreground">
          <Timer className="h-4 w-4" /> Oferta termina em 09:58
        </div>
      </div>
    </div>
  );
}

export function PaidSpecimen() {
  const steps = ["Cobrança criada", "Pix aprovado", "Acesso liberado", "Seu sistema avisado"];
  return (
    <div className="lp-spec w-full max-w-[480px] p-5">
      <div className="flex items-center gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><ArrowDownLeft className="h-5 w-5" strokeWidth={2.6} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-extrabold leading-tight text-foreground">Venda paga</span>
          <span className="block truncate text-[13px] text-muted-foreground">Pix, Maria Souza</span>
        </span>
        <span className="text-[1.35rem] font-extrabold tracking-[-0.03em] tabular-nums text-foreground">R$ 197,00</span>
      </div>
      <ol className="mt-5 grid gap-2.5 p-0">
        {steps.map((s) => (
          <li key={s} className="flex items-center gap-3 text-[14px] font-semibold text-foreground" style={{ listStyle: "none" }}>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="h-3 w-3" strokeWidth={3.5} /></span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

const PULSE: Array<"ok" | "bad" | "wait"> = ["ok", "ok", "ok", "ok", "ok", "ok", "ok", "ok", "ok", "ok", "bad", "ok", "ok", "ok", "ok", "ok", "ok", "ok", "ok", "ok", "ok", "ok", "ok", "wait"];

export function WebhookSpecimen() {
  return (
    <div className="lp-spec w-full max-w-[480px]">
      <div className="flex items-center gap-4 px-5 pb-3 pt-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold text-foreground">api.minhaloja.com.br</p>
          <p className="text-[12.5px] text-muted-foreground">Recebendo eventos</p>
        </div>
        <div className="lp-pulse w-[8.5rem]">{PULSE.map((k, i) => <i key={i} data-k={k === "ok" ? undefined : k} />)}</div>
      </div>
      {[
        { ok: true, t: "Pagamento aprovado", c: "payment.approved", m: "Seu servidor respondeu 200", w: "agora" },
        { ok: false, t: "Cobrança expirada", c: "payment.expired", m: "Seu servidor respondeu 503. Nova tentativa em 30 s", w: "há 2 min" },
      ].map((r) => (
        <div key={r.c} className="flex items-center gap-3.5 px-5 py-3.5" style={{ boxShadow: "0 -1px 0 hsl(var(--border))" }}>
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", r.ok ? "bg-accent text-accent-foreground" : "bg-destructive/15 text-destructive")}>
            {r.ok ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold leading-tight text-foreground">{r.t} <span className="ml-1 font-mono text-[11.5px] font-semibold text-muted-foreground">{r.c}</span></span>
            <span className="block text-[12.5px] leading-snug text-muted-foreground">{r.m}</span>
          </span>
          <span className="shrink-0 text-[12px] text-muted-foreground">{r.w}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 px-5 py-3.5 text-[13px] font-bold text-primary" style={{ boxShadow: "0 -1px 0 hsl(var(--border))" }}>
        <RefreshCw className="h-4 w-4" /> Reenviar o que falhou
      </div>
    </div>
  );
}

export function MemberSpecimen() {
  const lessons = [
    { t: "Boas-vindas", done: true },
    { t: "Como funciona uma oferta", done: true },
    { t: "Escolhendo o seu produto", now: true },
    { t: "Criando o primeiro anúncio" },
  ];
  return (
    <div className="lp-spec lp-dark w-full max-w-[480px] p-5">
      <p className="text-[12.5px]" style={{ color: "hsl(218 10% 62%)" }}>Olá, Maria</p>
      <p className="mt-3 text-[12px] font-bold" style={{ color: "hsl(156 82% 52%)" }}>Continuar de onde parou</p>
      <p className="mt-0.5 text-[1.2rem] font-extrabold tracking-[-0.025em]">Curso Marketing do Zero</p>
      <div className="lp-meter mt-3.5"><i style={{ width: "8%" }} /></div>
      <p className="mt-2 text-[12.5px]" style={{ color: "hsl(218 10% 62%)" }}>2 de 24 aulas concluídas</p>
      <ul className="m-0 mt-4 grid gap-1.5 p-0" style={{ listStyle: "none" }}>
        {lessons.map((l) => (
          <li key={l.t} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13.5px] font-semibold" style={{ background: l.now ? "hsl(152 45% 12%)" : "transparent", color: l.now ? "hsl(150 80% 66%)" : "hsl(150 14% 88%)" }}>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: l.done ? "hsl(156 82% 46%)" : l.now ? "hsl(156 82% 46% / .2)" : "hsl(220 16% 16%)", color: l.done ? "hsl(222 47% 8%)" : "hsl(156 82% 56%)" }}>
              {l.done ? <Check className="h-3 w-3" strokeWidth={3.5} /> : l.now ? <Play className="h-2.5 w-2.5 fill-current" /> : null}
            </span>
            {l.t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PayoutSpecimen() {
  return (
    <div className="lp-spec w-full max-w-[480px] p-5">
      <p className="text-[13.5px] font-semibold text-muted-foreground">Disponível para saque</p>
      <p className="mt-1 text-[2.2rem] font-extrabold leading-none tracking-[-0.045em] tabular-nums text-foreground">
        <span className="mr-1.5 text-[1.2rem] font-bold text-muted-foreground">R$</span>8.740<span className="text-[1.3rem] font-bold text-muted-foreground">,30</span>
      </p>
      <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-muted px-3.5 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-primary"><KeyRound className="h-4 w-4" /></span>
        <span className="min-w-0 text-[13.5px] leading-tight">
          <span className="block font-semibold text-muted-foreground">Chave Pix, CPF</span>
          <span className="block font-bold text-foreground">•••.456.789-••</span>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2.5 rounded-[14px] bg-accent px-3.5 py-3 text-[13px] font-semibold leading-snug text-accent-foreground">
        <Zap className="h-4 w-4 shrink-0" /> Saque automático ligado: saca sozinho quando o saldo chegar a R$ 1.500,00
      </div>
      <span className="lp-btn lp-btn-sm mt-4 pointer-events-none w-full">Solicitar saque</span>
    </div>
  );
}
