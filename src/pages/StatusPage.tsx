/**
 * Status dos serviços (`/status`). Mesma identidade clara da landing (`.vp-site.lp`).
 * Mede a partir do navegador de quem abre: servidor (`get_platform_pauses`, que também diz se a equipe pausou
 * pagamentos ou saques), login (`/auth/v1/health`) e se o checkout já tem adquirente. Regras em `features/status/statusModel.ts`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { parsePauses } from "@/hooks/usePlatformPauses";
import { defaultCheckoutProcessor } from "@/features/public-checkout/processor";
import { HEALTH_LABEL, buildRows, summarize, type Health, type Probe, type StatusInput } from "@/features/status/statusModel";
import "@/components/landing-vp/landing.css";
import "@/features/status/status.css";

const REFRESH_MS = 60_000;
const TIMEOUT_MS = 10_000;

async function timed<T>(job: () => Promise<T>): Promise<{ value: T | null; ms: number; ok: boolean }> {
  const start = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      job(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS); }),
    ]);
    return { value, ms: Math.round(performance.now() - start), ok: true };
  } catch {
    return { value: null, ms: Math.round(performance.now() - start), ok: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkAll(): Promise<StatusInput> {
  const [api, auth] = await Promise.all([
    timed(async () => {
      const { data, error } = await supabase.rpc("get_platform_pauses" as never);
      if (error) throw error;
      return parsePauses(data);
    }),
    timed(async () => {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      return true;
    }),
  ]);
  const probe = (r: { ms: number; ok: boolean }): Probe => ({ ok: r.ok, ms: r.ms });
  return { api: probe(api), auth: probe(auth), pauses: api.value, paymentsLive: defaultCheckoutProcessor.available };
}

const EMPTY: StatusInput = { api: null, auth: null, pauses: null, paymentsLive: defaultCheckoutProcessor.available };

function Dot({ health }: { health: Health }) {
  return <span className="st-dot" data-health={health} aria-hidden="true" />;
}

export default function StatusPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState<StatusInput>(EMPTY);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    const next = await checkAll();
    setInput(next);
    setCheckedAt(new Date());
    setBusy(false);
    running.current = false;
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("vx-scroll");
    void run();
    // Só confere de novo com a aba visível; ao voltar para a aba, confere na hora.
    const tick = window.setInterval(() => { if (document.visibilityState === "visible") void run(); }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      document.documentElement.classList.remove("vx-scroll");
    };
  }, [run]);

  const rows = buildRows(input);
  const summary = summarize(rows);
  const time = checkedAt?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <div className="vp-site lp min-h-dvh bg-background text-foreground">
      <Seo title="Status dos serviços — Vemprapay" description="Veja agora se o painel, o login, os pagamentos e os saques da Vemprapay estão funcionando." path="/status" />
      <header className="mx-auto flex h-16 max-w-[760px] items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5 no-underline" aria-label="Vemprapay, página inicial">
          <VenxpayLogo size={30} />
          <span className="text-[18px] font-extrabold tracking-[-0.035em] text-foreground">vempra<span className="text-primary">pay</span></span>
        </Link>
        <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} className="lp-btn lp-btn-sm lp-btn-text">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar
        </button>
      </header>

      <main className="mx-auto max-w-[760px] px-5 pb-20 pt-8 sm:px-8 sm:pt-14">
        <h1 className="text-[clamp(2rem,5vw,2.8rem)] font-extrabold leading-[1.08] tracking-[-0.04em]">Status dos serviços</h1>

        <section className="st-summary mt-8" data-tone={summary.tone} aria-live="polite">
          <Dot health={summary.tone === "ok" ? "ok" : summary.tone === "down" ? "down" : summary.tone === "warn" ? "paused" : "checking"} />
          <div className="min-w-0 flex-1">
            <p className="text-[1.15rem] font-extrabold tracking-[-0.02em]">{summary.title}</p>
            <p className="mt-0.5 text-[13.5px] text-muted-foreground">
              {time ? `Conferido às ${time} (horário de Brasília), a partir do seu navegador.` : "Conferindo agora, a partir do seu navegador."}
            </p>
          </div>
          <button type="button" className="lp-btn lp-btn-sm lp-btn-ghost shrink-0" onClick={() => void run()} disabled={busy} aria-label="Conferir de novo">
            <RefreshCw className={busy ? "h-4 w-4 animate-spin motion-reduce:animate-none" : "h-4 w-4"} aria-hidden="true" />
            <span className="hidden sm:inline">{busy ? "Conferindo…" : "Conferir de novo"}</span>
          </button>
        </section>

        <ul className="st-list mt-6" aria-label="Serviços">
          {rows.map((r) => (
            <li key={r.id} className="st-row">
              <Dot health={r.health} />
              <div className="min-w-0 flex-1">
                <p className="text-[15.5px] font-bold text-foreground">{r.name}</p>
                <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">{r.detail}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="st-label" data-health={r.health}>{HEALTH_LABEL[r.health]}</p>
                {r.ms !== undefined && <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">{r.ms} ms</p>}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-[38rem] text-[13.5px] leading-relaxed text-muted-foreground">
          A página confere de novo a cada minuto enquanto estiver aberta. Se algo aparece fora do ar só para você, pode ser a sua conexão.
          Precisa de ajuda? Entre no painel e abra um chamado em <Link to="/suporte" className="lp-link text-[13.5px]">Suporte</Link>.
        </p>
      </main>
    </div>
  );
}
