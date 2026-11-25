/**
 * PeriodPicker — seletor de período da plataforma (Início e Vendas).
 *
 * Atalhos à esquerda (Hoje, Ontem, 7/15/30/90 dias, este mês, mês passado), calendário à direita,
 * datas que também podem ser digitadas, teclado completo na grade e bottom sheet no celular.
 * As regras (atalhos, limites, rótulos, datas digitadas) ficam em `period/periodMeta.ts`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { addMonths, differenceInCalendarDays, endOfDay, format, getDaysInMonth, isSameDay, isSameMonth, startOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  MAX_PERIOD_DAYS, MIN_PERIOD_DATE, PERIOD_PRESETS, PROBLEM_TEXT, buildPeriod, formatBrDate, matchPreset, maskBrDate, nextDay, parseBrDate, periodLabel,
  periodSummary, rangeProblem, spanDays, todayInSaoPaulo, type PeriodPresetId, type PeriodValue,
} from "@/components/period/periodMeta";
import "@/components/period/period.css";

const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
const keyOf = (d: Date) => format(d, "yyyy-MM-dd");
const clampDay = (d: Date, today: Date) => (d > today ? today : d < MIN_PERIOD_DATE ? MIN_PERIOD_DATE : d);

/** Semanas do mês, com `null` nos dias que são de outro mês (só as semanas necessárias). */
function monthMatrix(month: Date): Array<Date | null> {
  const first = startOfMonth(month);
  const total = getDaysInMonth(first);
  const cells = Math.ceil((first.getDay() + total) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => {
    const day = i - first.getDay() + 1;
    return day >= 1 && day <= total ? new Date(first.getFullYear(), first.getMonth(), day) : null;
  });
}

/* ═════════════ Painel ═════════════ */

function PeriodPanel({ value, onApply, onClose, mobile }: { value: PeriodValue; onApply: (v: PeriodValue) => void; onClose: () => void; mobile: boolean }) {
  const today = useMemo(() => todayInSaoPaulo(), []);
  const [from, setFrom] = useState<Date | null>(startOfDay(value.from));
  const [to, setTo] = useState<Date | null>(startOfDay(value.to));
  const [hover, setHover] = useState<Date | null>(null);
  const [month, setMonth] = useState<Date>(startOfMonth(value.from));
  const [focus, setFocus] = useState<Date>(clampDay(startOfDay(value.to), today));
  const [fromText, setFromText] = useState(formatBrDate(value.from));
  const [toText, setToText] = useState(formatBrDate(value.to));
  const [note, setNote] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  const days = useMemo(() => monthMatrix(month), [month]);
  const canPrev = differenceInCalendarDays(startOfMonth(month), MIN_PERIOD_DATE) > 0;
  const canNext = !isSameMonth(month, today) && startOfMonth(month) < startOfMonth(today);
  const activePreset = from ? matchPreset(from, to ?? from, today) : null;

  // Depois de uma tecla de seta, o foco acompanha o dia escolhido (mesmo trocando de mês).
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${keyOf(focus)}"]`)?.focus();
  }, [focus, month]);

  const commit = (nextFrom: Date | null, nextTo: Date | null, opts: { text?: boolean; follow?: boolean } = {}) => {
    setFrom(nextFrom);
    setTo(nextTo);
    if (opts.text !== false) {
      setFromText(nextFrom ? formatBrDate(nextFrom) : "");
      setToText(nextTo ? formatBrDate(nextTo) : "");
    }
    if (opts.follow && nextFrom) { setMonth(startOfMonth(nextFrom)); setFocus(clampDay(nextTo ?? nextFrom, today)); }
  };

  const pickDay = (raw: Date) => {
    const day = startOfDay(raw);
    setFocus(day);
    // Sem início, ou intervalo já fechado: este clique começa um novo intervalo.
    if (!from || to) { setNote(null); commit(day, null); return; }
    const [lo, hi] = day < from ? [day, from] : [from, day];
    const problem = rangeProblem(lo, hi, today);
    if (problem) { setNote(PROBLEM_TEXT[problem]); return; }
    setNote(null);
    commit(lo, hi);
  };

  const changeMonth = (delta: number) => {
    const next = addMonths(month, delta);
    setMonth(next);
    setFocus(clampDay(startOfMonth(next), today));
  };

  const choosePreset = (id: PeriodPresetId) => onApply(buildPeriod(id, today));

  const typed = (which: "from" | "to", raw: string) => {
    const text = maskBrDate(raw);
    (which === "from" ? setFromText : setToText)(text);
    if (text.length < 10) { setNote(null); return; }
    const parsed = parseBrDate(text);
    if (!parsed) { setNote("Data inválida. Use o formato dd/mm/aaaa."); return; }
    if (which === "from") {
      const keepTo = to && parsed <= to ? to : null;
      const problem = rangeProblem(parsed, keepTo ?? parsed, today);
      if (problem === "too_long" && keepTo) {
        // A data final antiga não cabe mais: mantém a inicial e pede uma nova final.
        commit(parsed, null, { follow: true });
        setNote("Com essa data inicial o período passaria de 1 ano. Escolha a data final.");
        return;
      }
      if (problem) { setNote(PROBLEM_TEXT[problem]); return; }
      setNote(null);
      commit(parsed, keepTo, { text: false, follow: true });
      if (!keepTo) setToText("");
    } else {
      if (!from) { setNote("Preencha primeiro a data inicial."); return; }
      if (parsed < from) { setNote("A data final vem antes da inicial."); return; }
      const problem = rangeProblem(from, parsed, today);
      if (problem) { setNote(PROBLEM_TEXT[problem]); return; }
      setNote(null);
      commit(from, parsed, { text: false, follow: true });
    }
  };
  // Ao sair do campo, volta ao último valor válido (nunca deixa texto pela metade).
  const settleTexts = () => { setFromText(from ? formatBrDate(from) : ""); setToText(to ? formatBrDate(to) : ""); };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: Date | null = null;
    if (e.key in step) next = nextDay(focus, step[e.key]);
    else if (e.key === "Home") next = nextDay(focus, -focus.getDay());
    else if (e.key === "End") next = nextDay(focus, 6 - focus.getDay());
    else if (e.key === "PageUp" || e.key === "PageDown") next = addMonths(focus, (e.key === "PageUp" ? -1 : 1) * (e.shiftKey ? 12 : 1));
    if (!next) return;
    e.preventDefault();
    const target = clampDay(next, today);
    moveFocus.current = true;
    setFocus(target);
    if (!isSameMonth(target, month)) setMonth(startOfMonth(target));
  };

  const apply = () => {
    if (!from) return;
    const hi = to ?? from;
    const problem = rangeProblem(from, hi, today);
    if (problem) { setNote(PROBLEM_TEXT[problem]); return; }
    onApply({ presetId: matchPreset(from, hi, today), from: startOfDay(from), to: endOfDay(hi) });
  };

  const railEnd = to ?? (from && hover && !isSameDay(hover, from) ? hover : null);
  const lo = from && railEnd ? (railEnd < from ? railEnd : from) : null;
  const hi = from && railEnd ? (railEnd < from ? from : railEnd) : null;
  const cell = mobile ? "42px" : "40px";

  return (
    <div className={cn("flex flex-col", mobile ? "max-h-[88dvh]" : "w-[min(640px,92vw)]")}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">Escolher período</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Escolha um atalho ou marque os dias no calendário.</p>
        </div>
        {mobile && <button type="button" onClick={onClose} aria-label="Fechar" className="vp-orb !h-10 !w-10"><X className="h-4 w-4" /></button>}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 sm:px-6">
        <div className={cn(mobile ? "space-y-4" : "flex gap-6")}>
          <div role="group" aria-label="Atalhos de período" className={cn(mobile ? "pd-presets-row" : "flex w-[150px] shrink-0 flex-col gap-1")}>
            {PERIOD_PRESETS.map((p) => (
              <button key={p.id} type="button" className="vp-pill pd-preset" aria-pressed={activePreset === p.id} onClick={() => choosePreset(p.id)} title={p.hint}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <label className="block text-[13px] font-semibold text-foreground">De
                <input className="vp-field mt-1.5" style={{ height: 44 }} inputMode="numeric" autoComplete="off" placeholder="dd/mm/aaaa" value={fromText} onChange={(e) => typed("from", e.target.value)} onBlur={settleTexts} aria-invalid={!!note && note.startsWith("Data inválida") ? true : undefined} />
              </label>
              <label className="block text-[13px] font-semibold text-foreground">Até
                <input className="vp-field mt-1.5" style={{ height: 44 }} inputMode="numeric" autoComplete="off" placeholder="dd/mm/aaaa" value={toText} onChange={(e) => typed("to", e.target.value)} onBlur={settleTexts} />
              </label>
            </div>

            <div className="mt-4" style={{ "--pd-cell": cell } as React.CSSProperties}>
              <div className="mb-1.5 flex items-center justify-between">
                <button type="button" className="pd-nav" aria-label="Mês anterior" disabled={!canPrev} onClick={() => changeMonth(-1)}><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-[15px] font-bold capitalize tracking-[-0.01em] text-foreground" aria-live="polite">{format(month, "MMMM yyyy", { locale: ptBR })}</span>
                <button type="button" className="pd-nav" aria-label="Próximo mês" disabled={!canNext} onClick={() => changeMonth(1)}><ChevronRight className="h-4 w-4" /></button>
              </div>

              <div className="grid grid-cols-7" aria-hidden>
                {WEEK.map((w, i) => <span key={i} className="grid h-7 place-items-center text-[12px] font-semibold text-muted-foreground">{w}</span>)}
              </div>

              <div ref={gridRef} role="grid" aria-label={`Calendário de ${format(month, "MMMM 'de' yyyy", { locale: ptBR })}`} onKeyDown={onGridKey} onMouseLeave={() => setHover(null)} className="grid grid-cols-7">
                {days.map((d, i) => {
                  if (!d) return <div key={`blank-${i}`} role="gridcell" aria-hidden className="pd-day" />;
                  const future = d > today;
                  const edgeFrom = !!from && isSameDay(d, from);
                  const edgeTo = !!to && isSameDay(d, to);
                  const selected = edgeFrom || edgeTo;
                  const rail = lo && hi && lo < hi
                    ? isSameDay(d, lo) ? "start" : isSameDay(d, hi) ? "end" : d > lo && d < hi ? "mid" : undefined
                    : undefined;
                  const capStart = i % 7 === 0 || !days[i - 1];
                  const capEnd = i % 7 === 6 || !days[i + 1];
                  const label = format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
                  return (
                    <div key={keyOf(d)} role="gridcell" data-rail={rail} data-cs={capStart || undefined} data-ce={capEnd || undefined} className="pd-day">
                      <button
                        type="button"
                        className="pd-btn"
                        data-date={keyOf(d)}
                        data-today={isSameDay(d, today)}
                        disabled={future}
                        tabIndex={isSameDay(d, focus) ? 0 : -1}
                        aria-pressed={selected}
                        aria-current={isSameDay(d, today) ? "date" : undefined}
                        aria-label={`${label}${edgeFrom && edgeTo ? ", dia escolhido" : edgeFrom ? ", início do período" : edgeTo ? ", fim do período" : ""}`}
                        onClick={() => pickDay(d)}
                        onMouseEnter={() => setHover(d)}
                        onFocus={() => setFocus(d)}
                      >
                        {d.getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <p role="status" aria-live="polite" className={cn("mt-3 min-h-[20px] text-[13px]", note ? "font-semibold text-destructive" : "text-muted-foreground")}>
              {note ?? (from && to && spanDays(from, to) > 0 ? `Máximo de ${MAX_PERIOD_DAYS} dias por vez.` : "")}
            </p>
          </div>
        </div>
      </div>

      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 bg-card px-5 py-3.5 shadow-[0_-1px_0_hsl(var(--border))] sm:px-6", mobile && "pb-[max(1rem,env(safe-area-inset-bottom))]")}>
        <span className={cn("min-w-0 flex-1 text-[13.5px] font-semibold text-foreground", mobile && "basis-full")}>{periodSummary(from, to)}</span>
        {!mobile && <button type="button" onClick={onClose} className="vp-ghost h-11 px-5">Cancelar</button>}
        <button type="button" onClick={apply} disabled={!from} className={cn("vp-cta h-11 px-6", mobile && "w-full !h-[52px]")}>
          <CalendarDays className="h-4 w-4" aria-hidden />Aplicar período
        </button>
      </div>
    </div>
  );
}

export interface PeriodPickerProps {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
  trigger: ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

export function PeriodPicker({ value, onChange, trigger, open, onOpenChange, align = "end", side = "bottom" }: PeriodPickerProps) {
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const handleApply = (v: PeriodValue) => { onChange(v); setOpen(false); };

  if (isMobile) {
    return (
      <>
        <span onClick={() => setOpen(true)} className="contents">{trigger}</span>
        <Sheet open={isOpen} onOpenChange={setOpen}>
          <SheetContent side="bottom" hideClose className="rounded-t-[28px] border-x-0 border-b-0 bg-card p-0 pt-3">
            <SheetTitle className="sr-only">Escolher período</SheetTitle>
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-border" />
            {isOpen && <PeriodPanel value={value} onApply={handleApply} onClose={() => setOpen(false)} mobile />}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} side={side} sideOffset={10} collisionPadding={16} className="w-auto max-w-[94vw] rounded-[24px] p-0">
        <PeriodPanel value={value} onApply={handleApply} onClose={() => setOpen(false)} mobile={false} />
      </PopoverContent>
    </Popover>
  );
}
