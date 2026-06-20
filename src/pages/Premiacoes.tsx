/**
 * Premiações — Catálogo editorial HOTZFY
 * Estética: casa de leilões / catálogo de relojoaria. Monocromática,
 * tipografia editorial, hairlines, sem glow/blur/rainbow.
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Trophy, Lock, CheckCircle2, ArrowUpRight, ChevronLeft, ChevronRight, Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import braceletCard from "@/assets/awards/bracelet-card-10k.png";
import plaque100k from "@/assets/awards/plaque-100k.png";
import plaque250k from "@/assets/awards/plaque-250k.png";
import plaque500k from "@/assets/awards/plaque-500k.png";
import plaque1m from "@/assets/awards/plaque-1m.png";
import plaque5m from "@/assets/awards/plaque-5m.png";
import plaque10m from "@/assets/awards/plaque-10m.png";

type AwardItem = {
  id: string; value: number; label: string; tier: string;
  title: string; description: string; image: string;
  rewards: string[]; phrase: string; ref: string;
};

const AWARDS: AwardItem[] = [
  { id: "10k",  value: 10_000,     label: "R$ 10K",  tier: "I — Iniciante", title: "Kit Couro & Cartão Black",  description: "Pulseira de couro premium costurada à mão e Cartão Black numerado. Entregue em estojo lacrado.", image: braceletCard, rewards: ["Pulseira de couro premium", "Cartão Black numerado"], phrase: "Toda jornada bilionária começa com a primeira venda.", ref: "HZF-001" },
  { id: "100k", value: 100_000,    label: "R$ 100K", tier: "II — Bronze",    title: "Placa Bronze Patinado",     description: "Placa em mármore negro com chapa de bronze envelhecido. Numerada, gravada com o seu nome.",     image: plaque100k,   rewards: ["Placa em bronze numerada"], phrase: "Bronze não é metal — é a prova de que você começou.", ref: "HZF-100" },
  { id: "250k", value: 250_000,    label: "R$ 250K", tier: "III — Prata",    title: "Placa Prata Platinada",     description: "Acabamento prata platinada sobre base em mármore negro. Marco intermediário de prestígio.",       image: plaque250k,   rewards: ["Placa prata platinada"], phrase: "Prata pesa porque foi merecida.", ref: "HZF-250" },
  { id: "500k", value: 500_000,    label: "R$ 500K", tier: "IV — Ouro 24K",  title: "Placa Ouro 24K",            description: "Banhada a ouro 24K com detalhes em esmeralda. Para sellers que dominaram seu mercado.",         image: plaque500k,   rewards: ["Placa banhada a ouro 24K", "Acesso ao grupo VIP"], phrase: "Ouro não brilha sozinho. Você fez ele brilhar.", ref: "HZF-500" },
  { id: "1m",   value: 1_000_000,  label: "R$ 1M",   tier: "V — Diamante",   title: "Placa Diamante",            description: "Cravejada em diamante autêntico. O primeiro milhão registrado em catálogo.",                     image: plaque1m,     rewards: ["Placa cravejada", "Convite Hotzfy Inner Circle"], phrase: "Diamante é carbono que resistiu à pressão.", ref: "HZF-1MM" },
  { id: "5m",   value: 5_000_000,  label: "R$ 5M",   tier: "VI — Elite",     title: "Placa Elite Rose Gold",     description: "Rose Gold com diamantes negros. Reservada à elite — menos de 0,5% dos sellers atingem.",         image: plaque5m,     rewards: ["Placa Rose Gold", "Jantar privado com a fundação"], phrase: "Elite não é título — é hábito.", ref: "HZF-5MM" },
  { id: "10m",  value: 10_000_000, label: "R$ 10M",  tier: "VII — Lenda",    title: "Placa Lenda",               description: "Gemas preciosas multicoloridas, peça única numerada, assinada pela fundação HOTZFY.",             image: plaque10m,    rewards: ["Placa Lenda numerada", "Hall of Fame HOTZFY", "Bonificação personalizada"], phrase: "Lendas não morrem. Faturam.", ref: "HZF-10M" },
];

const fmtFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export default function Premiacoes() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [existingClaims, setExistingClaims] = useState<any[]>([]);
  const [claimForm, setClaimForm] = useState({
    recipient_name: "", phone: "", document: "",
    shipping_street: "", shipping_number: "", shipping_complement: "",
    shipping_neighborhood: "", shipping_city: "", shipping_state: "", shipping_zip: "",
  });

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("transactions").select("net_amount")
      .eq("user_id", user.id).eq("status", "completed")
      .then(({ data }) => { if (data) setRevenue(data.reduce((s, t) => s + Number(t.net_amount), 0)); });
    (supabase as any).from("reward_claims").select("id, tier_id, status").eq("user_id", user.id)
      .then(({ data }: any) => { if (data) setExistingClaims(data); });
  }, [user?.id]);

  const { unlockedCount, nextAward, currentTier, overallProgress, remaining } = useMemo(() => {
    const currentIdx = AWARDS.findIndex((a) => revenue < a.value);
    const unlockedCount = AWARDS.filter((a) => revenue >= a.value).length;
    const nextAward = currentIdx >= 0 ? AWARDS[currentIdx] : null;
    const currentTier = unlockedCount > 0 ? AWARDS[unlockedCount - 1] : null;
    const overallProgress = (unlockedCount / AWARDS.length) * 100;
    const remaining = nextAward ? nextAward.value - revenue : 0;
    return { currentIdx, unlockedCount, nextAward, currentTier, overallProgress, remaining };
  }, [revenue]);

  const focused = useMemo(() => {
    if (focusId) return AWARDS.find((a) => a.id === focusId) ?? nextAward ?? AWARDS[AWARDS.length - 1];
    return nextAward ?? AWARDS[AWARDS.length - 1];
  }, [focusId, nextAward]);

  const focusedIdx = AWARDS.findIndex((a) => a.id === focused.id);
  const focusedDone = revenue >= focused.value;
  const focusedProgress = Math.min((revenue / focused.value) * 100, 100);
  const alreadyClaimed = existingClaims.some(c => c.tier_id === focused.id && c.status !== "cancelled");

  const goPrev = () => setFocusId(AWARDS[Math.max(focusedIdx - 1, 0)].id);
  const goNext = () => setFocusId(AWARDS[Math.min(focusedIdx + 1, AWARDS.length - 1)].id);

  return (
    <div className="space-y-10 animate-fade-in pb-6">
      {/* ===== EDITORIAL MASTHEAD ===== */}
      <header className="border-y border-border bg-background">
        <div className="flex items-center justify-between border-b border-border/60 px-1 py-2 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          <span className="font-mono">HOTZFY / Catálogo Oficial</span>
          <span className="font-mono tabular-nums">Vol. {new Date().getFullYear()} · Ed. 01</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-8 md:gap-10 px-1 py-8 md:py-12">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground mb-5">
              N.º 07 — Sete marcos. Sete peças. Uma carreira.
            </p>
            <h1 className="font-display font-black text-foreground leading-[0.92] tracking-[-0.04em] text-[44px] sm:text-[64px] lg:text-[88px]">
              Premiações<span className="text-primary">.</span>
            </h1>
            <p className="mt-6 max-w-[52ch] text-[15px] leading-[1.65] text-muted-foreground">
              Não é um troféu. É um registro. Cada peça do catálogo HOTZFY é fabricada,
              numerada e entregue como reconhecimento físico do faturamento alcançado —
              do primeiro <span className="text-foreground font-medium">R$ 10 mil</span> ao
              hall dos <span className="text-foreground font-medium">R$ 10 milhões</span>.
            </p>
          </div>

          <aside className="border-l border-border md:pl-8 flex flex-col justify-end">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Stat label="Faturamento" value={fmtFull(revenue)} />
              <Stat label="Tier atual" value={currentTier ? currentTier.tier.split(" — ")[1] : "—"} />
              <Stat label="Próximo marco" value={nextAward ? nextAward.label : "Lenda"} />
              <Stat label="Conquistados" value={`${unlockedCount} / ${AWARDS.length}`} />
            </div>
            <div className="mt-6 h-px bg-border" />
            <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-mono">
              <span>Jornada</span>
              <span className="tabular-nums text-foreground">{overallProgress.toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-[2px] bg-border overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-1000"
                style={{ width: `${Math.max(overallProgress, 1.5)}%` }}
              />
            </div>
          </aside>
        </div>
      </header>

      {/* ===== FEATURE — Item em destaque ===== */}
      <section className="border border-border bg-card">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
          {/* Plate display */}
          <div className="relative border-b lg:border-b-0 lg:border-r border-border bg-[hsl(var(--background))]">
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
              style={{
                backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div className="absolute top-0 left-0 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Lote {focused.ref}
            </div>
            <div className="absolute top-0 right-0 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.28em]">
              {focusedDone
                ? <span className="text-primary inline-flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" strokeWidth={2.5} /> Conquistado</span>
                : <span className="text-muted-foreground inline-flex items-center gap-1.5"><Lock className="h-3 w-3" strokeWidth={2.5} /> Selado</span>}
            </div>

            <div className="relative aspect-[5/4] flex items-center justify-center p-10">
              <img
                key={focused.id}
                src={focused.image}
                alt={focused.title}
                className={cn(
                  "max-h-[88%] max-w-[88%] object-contain transition-all duration-500",
                  "animate-fade-in",
                  !focusedDone && "grayscale opacity-40"
                )}
              />
            </div>

            {/* Caption rail */}
            <div className="border-t border-border flex items-stretch">
              <button
                onClick={goPrev}
                disabled={focusedIdx === 0}
                aria-label="Anterior"
                className="px-4 border-r border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              </button>
              <div className="flex-1 px-5 py-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                <span>Peça {String(focusedIdx + 1).padStart(2, "0")} / {String(AWARDS.length).padStart(2, "0")}</span>
                <span className="text-foreground tabular-nums">{focused.label}</span>
              </div>
              <button
                onClick={goNext}
                disabled={focusedIdx === AWARDS.length - 1}
                aria-label="Próximo"
                className="px-4 border-l border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Editorial copy */}
          <div className="p-8 sm:p-10 flex flex-col">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary">
              {focused.tier}
            </p>
            <h2 className="mt-4 font-display font-black text-foreground text-[32px] sm:text-[40px] leading-[1] tracking-[-0.03em]">
              {focused.title}
            </h2>
            <p className="mt-4 text-[14px] leading-[1.7] text-muted-foreground max-w-[44ch]">
              {focused.description}
            </p>

            <figure className="mt-7 border-l border-primary pl-5 py-1">
              <blockquote className="font-display text-[18px] leading-snug text-foreground tracking-[-0.01em] italic">
                “{focused.phrase}”
              </blockquote>
              <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                — HOTZFY, manifesto
              </figcaption>
            </figure>

            <dl className="mt-8 border-t border-border divide-y divide-border">
              <Row k="Critério" v={`Faturamento líquido ≥ ${fmtFull(focused.value)}`} />
              <Row k="Itens inclusos" v={focused.rewards.join(" · ")} />
              <Row k="Entrega" v="Postagem rastreada após validação" />
              <Row k="Edição" v="Numerada · gravada com o seu nome" />
            </dl>

            <div className="mt-auto pt-8">
              <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                <span>{focusedDone ? "Status" : "Progresso"}</span>
                <span className="tabular-nums text-foreground">
                  {focusedDone ? "100%" : `${focusedProgress.toFixed(1)}%`}
                </span>
              </div>
              <div className="mt-2 h-[2px] bg-border overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-700"
                  style={{ width: `${Math.max(focusedProgress, 1.5)}%` }}
                />
              </div>
              {!focusedDone && (
                <p className="mt-3 text-[12px] text-muted-foreground tabular-nums">
                  Faltam <span className="font-medium text-foreground">{fmtFull(Math.max(remaining || focused.value - revenue, 0))}</span>
                </p>
              )}

              <button
                type="button"
                onClick={() => focusedDone && !alreadyClaimed && setClaimOpen(true)}
                disabled={!focusedDone || alreadyClaimed}
                className={cn(
                  "mt-6 group w-full inline-flex items-center justify-between gap-3 px-5 h-12 border transition-colors font-mono text-[11px] uppercase tracking-[0.24em]",
                  focusedDone && !alreadyClaimed
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    : alreadyClaimed
                      ? "border-border bg-muted/30 text-muted-foreground cursor-default"
                      : "border-border bg-transparent text-muted-foreground cursor-default"
                )}
              >
                <span>
                  {alreadyClaimed ? "Solicitação registrada"
                    : focusedDone ? "Solicitar resgate"
                    : "Bloqueado · atinja a meta"}
                </span>
                {focusedDone && !alreadyClaimed
                  ? <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2} />
                  : alreadyClaimed
                    ? <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                    : <Lock className="h-3.5 w-3.5" strokeWidth={2} />}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CATÁLOGO (index editorial) ===== */}
      <section>
        <div className="flex items-end justify-between border-b border-border pb-3 mb-0">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Índice</p>
            <h3 className="mt-2 font-display font-black text-foreground text-[28px] sm:text-[34px] leading-none tracking-[-0.03em]">
              O catálogo completo
            </h3>
          </div>
          <p className="hidden sm:block font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground tabular-nums">
            {unlockedCount}/{AWARDS.length} conquistados · {overallProgress.toFixed(0)}% da jornada
          </p>
        </div>

        <ul className="divide-y divide-border border-b border-border">
          {AWARDS.map((a, i) => {
            const done = revenue >= a.value;
            const isFocused = focused.id === a.id;
            const progress = Math.min((revenue / a.value) * 100, 100);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setFocusId(a.id)}
                  className={cn(
                    "group w-full text-left grid grid-cols-[40px_72px_1.2fr_1fr_auto] items-center gap-5 px-1 py-5 transition-colors",
                    "hover:bg-muted/40",
                    isFocused && "bg-muted/30"
                  )}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="relative h-[72px] w-[72px] border border-border bg-background flex items-center justify-center overflow-hidden">
                    <img
                      src={a.image}
                      alt=""
                      className={cn(
                        "max-h-[80%] max-w-[80%] object-contain transition-transform duration-500 group-hover:scale-[1.06]",
                        !done && "grayscale opacity-40"
                      )}
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{a.tier}</p>
                    <p className="mt-1 font-display font-black text-foreground text-[18px] leading-tight tracking-[-0.02em] truncate">
                      {a.title}
                    </p>
                  </div>

                  <div className="hidden md:block">
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-1.5">
                      <span>{done ? "Conquistado" : "Progresso"}</span>
                      <span className="tabular-nums text-foreground">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-[2px] bg-border overflow-hidden">
                      <div
                        className={cn("h-full transition-[width] duration-700", done ? "bg-primary" : "bg-foreground/50")}
                        style={{ width: `${Math.max(progress, 1.5)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 justify-self-end">
                    <span className="font-display font-black tabular-nums text-foreground text-[20px] leading-none tracking-[-0.02em]">
                      {a.label}
                    </span>
                    {done ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.24em] text-primary">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} /> Ok
                      </span>
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          Fim do catálogo · Hall of Fame reservado a quem ultrapassa R$ 10M.
        </p>
      </section>

      {/* ===== Claim dialog ===== */}
      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display tracking-tight">
              <Gift className="h-4 w-4 text-primary" /> Solicitar {focused.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Preencha os dados de envio. A equipe HOTZFY entrará em contato após a postagem.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input placeholder="Nome do recebedor *" value={claimForm.recipient_name} onChange={e => setClaimForm({ ...claimForm, recipient_name: e.target.value })} />
              <Input placeholder="Telefone (com DDD) *" value={claimForm.phone} onChange={e => setClaimForm({ ...claimForm, phone: e.target.value })} />
              <Input placeholder="CPF / CNPJ" value={claimForm.document} onChange={e => setClaimForm({ ...claimForm, document: e.target.value })} className="sm:col-span-2" />
              <Input placeholder="Rua *" value={claimForm.shipping_street} onChange={e => setClaimForm({ ...claimForm, shipping_street: e.target.value })} className="sm:col-span-2" />
              <Input placeholder="Número *" value={claimForm.shipping_number} onChange={e => setClaimForm({ ...claimForm, shipping_number: e.target.value })} />
              <Input placeholder="Complemento" value={claimForm.shipping_complement} onChange={e => setClaimForm({ ...claimForm, shipping_complement: e.target.value })} />
              <Input placeholder="Bairro *" value={claimForm.shipping_neighborhood} onChange={e => setClaimForm({ ...claimForm, shipping_neighborhood: e.target.value })} className="sm:col-span-2" />
              <Input placeholder="Cidade *" value={claimForm.shipping_city} onChange={e => setClaimForm({ ...claimForm, shipping_city: e.target.value })} />
              <Input placeholder="UF *" maxLength={2} value={claimForm.shipping_state} onChange={e => setClaimForm({ ...claimForm, shipping_state: e.target.value.toUpperCase() })} />
              <Input placeholder="CEP *" value={claimForm.shipping_zip} onChange={e => setClaimForm({ ...claimForm, shipping_zip: e.target.value })} className="sm:col-span-2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClaimOpen(false)}>Cancelar</Button>
            <Button disabled={submittingClaim} onClick={async () => {
              if (!user?.id) return;
              const required = ["recipient_name","phone","shipping_street","shipping_number","shipping_neighborhood","shipping_city","shipping_state","shipping_zip"] as const;
              for (const k of required) if (!String((claimForm as any)[k] || "").trim()) { toast.error("Preencha todos os campos obrigatórios"); return; }
              setSubmittingClaim(true);
              const { error, data } = await (supabase as any).from("reward_claims").insert({
                user_id: user.id,
                tier_id: focused.id, tier_label: focused.title, tier_value: focused.value,
                recipient_name: claimForm.recipient_name.trim(),
                phone: claimForm.phone.trim(),
                document: claimForm.document.trim() || null,
                shipping_street: claimForm.shipping_street.trim(),
                shipping_number: claimForm.shipping_number.trim(),
                shipping_complement: claimForm.shipping_complement.trim() || null,
                shipping_neighborhood: claimForm.shipping_neighborhood.trim(),
                shipping_city: claimForm.shipping_city.trim(),
                shipping_state: claimForm.shipping_state.trim(),
                shipping_zip: claimForm.shipping_zip.trim(),
              }).select().maybeSingle();
              setSubmittingClaim(false);
              if (error) { toast.error("Erro ao solicitar premiação"); return; }
              if (data) setExistingClaims(prev => [...prev, data]);
              toast.success("Premiação solicitada! Você receberá atualizações por notificação.");
              setClaimOpen(false);
            }}>{submittingClaim ? "Enviando..." : "Confirmar solicitação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- atoms ---------- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display font-black text-foreground text-[18px] tabular-nums leading-none tracking-[-0.02em] truncate">
        {value}
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground pt-0.5">{k}</dt>
      <dd className="text-[13px] text-foreground leading-relaxed">{v}</dd>
    </div>
  );
}
