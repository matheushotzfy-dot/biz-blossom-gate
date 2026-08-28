/**
 * PeriodPicker — seletor de período único da plataforma.
 *
 * Grade de mês própria (sem react-day-picker), no padrão VENXPAY:
 * bordas hairline, cantos suaves, esmeralda sólido nas extremidades do
 * intervalo e trilho suave nos dias intermediários.
 *
 * Desktop: popover fluido (presets à esquerda, calendário à direita).
 * Mobile: bottom sheet com células de toque e ação fixa com safe-area.
 */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type PeriodPresetId = "today" | "yesterday" | "7d" | "15d" | "30d" | "month";

export interface PeriodValue {
  /** null = intervalo personalizado escolhido no calendário */
  presetId: PeriodPresetId | null;
  from: Date;
  to: Date;
}

interface PresetDef {
  id: PeriodPresetId;
  label: string;
  hint: string;
  build: () => { from: Date; to: Date };
}

/** Data "hoje" no fuso de São Paulo, normalizada para meia-noite local. */
export function todayInSaoPaulo(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return new Date(get("year"), get("month") - 1, get("day"));
}

export const PERIOD_PRESETS: PresetDef[] = [
  { id: "today", label: "Hoje", hint: "Movimento do dia", build: () => { const n = todayInSaoPaulo(); return { from: startOfDay(n), to: endOfDay(n) }; } },
  { id: "yesterday", label: "Ontem", hint: "Dia anterior", build: () => { const y = subDays(todayInSaoPaulo(), 1); return { from: startOfDay(y), to: endOfDay(y) }; } },
  { id: "7d", label: "7 dias", hint: "Última semana", build: () => { const n = todayInSaoPaulo(); return { from: startOfDay(subDays(n, 6)), to: endOfDay(n) }; } },
  { id: "15d", label: "15 dias", hint: "Quinzena", build: () => { const n = todayInSaoPaulo(); return { from: startOfDay(subDays(n, 14)), to: endOfDay(n) }; } },
  { id: "30d", label: "30 dias", hint: "Último mês", build: () => { const n = todayInSaoPaulo(); return { from: startOfDay(subDays(n, 29)), to: endOfDay(n) }; } },
  { id: "month", label: "Este mês", hint: "Mês corrente", build: () => { const n = todayInSaoPaulo(); return { from: startOfMonth(n), to: endOfDay(n) }; } },
];

export function buildPeriod(id: PeriodPresetId): PeriodValue {
  const preset = PERIOD_PRESETS.find((p) => p.id === id) ?? PERIOD_PRESETS[0];
  return { presetId: preset.id, ...preset.build() };
}

export function periodLabel(value: PeriodValue | undefined): string {
  if (!value) return "Selecionar período";
  if (value.presetId) return PERIOD_PRESETS.find((p) => p.id === value.presetId)?.label ?? "Período";
  const sameDay = format(value.from, "ddMMyy") === format(value.to, "ddMMyy");
  return sameDay
    ? format(value.from, "dd MMM", { locale: ptBR })
    : `${format(value.from, "dd MMM", { locale: ptBR })} — ${format(value.to, "dd MMM", { locale: ptBR })}`;
}

/* ═════════════ Grade de mês própria ═════════════ */

const WEEK_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Matriz de 6 semanas × 7 dias cobrindo o mês informado. */
function buildMonthMatrix(month: Date): Date[] {
  const first = startOfMonth(month);
  const offset = first.getDay();
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
}

interface MonthGridProps {
  month: Date;
  onMonthChange: (d: Date) => void;
  from: Date | null;
  to: Date | null;
  onPick: (d: Date) => void;
  compact: boolean;
}

function MonthGrid({ month, onMonthChange, from, to, onPick, compact }: MonthGridProps) {
  const today = todayInSaoPaulo();
  const days = useMemo(() => buildMonthMatrix(month), [month]);
  const canGoNext = !isSameMonth(month, today) && !isAfter(startOfMonth(month), today);

  const inRange = (d: Date) => Boolean(from && to && d > from && d < to);
  const isEdge = (d: Date) => Boolean((from && isSameDay(d, from)) || (to && isSameDay(d, to)));

  return (
    <div className="min-w-0">
      {/* Navegação */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-border/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-display text-[13px] font-bold capitalize tracking-[-0.01em] text-foreground">
          {format(month, "MMMM yyyy", { locale: ptBR })}
        </span>
        <button
          type="button"
          aria-label="Próximo mês"
          disabled={!canGoNext}
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-border/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-30 disabled:hover:border-border/60 disabled:hover:text-muted-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Cabeçalho de semana */}
      <div className="grid grid-cols-7">
        {WEEK_LABELS.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className="flex h-6 items-center justify-center font-display text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground/45"
          >
            {w}
          </span>
        ))}
      </div>

      {/* Dias */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          const outside = !isSameMonth(d, month);
          const future = isAfter(startOfDay(d), startOfDay(today));
          const edge = isEdge(d);
          const middle = inRange(d);
          const disabled = future;

          return (
            <div
              key={d.toISOString()}
              className={cn(
                "relative flex items-center justify-center",
                compact ? "h-9" : "h-11",
                middle && "bg-primary/[0.10]",
                from && to && isSameDay(d, from) && !isSameDay(from, to) && "rounded-l-[10px] bg-primary/[0.10]",
                from && to && isSameDay(d, to) && !isSameDay(from, to) && "rounded-r-[10px] bg-primary/[0.10]",
              )}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(d)}
                className={cn(
                  "relative z-10 flex items-center justify-center rounded-[10px] font-display font-semibold tabular-nums transition-colors",
                  compact ? "h-9 w-9 text-[12.5px]" : "h-10 w-10 text-[13.5px]",
                  disabled && "cursor-not-allowed text-muted-foreground/20",
                  !disabled && outside && "text-muted-foreground/30",
                  !disabled && !outside && "text-foreground/85 hover:bg-secondary/60",
                  edge && "!bg-primary !text-primary-foreground",
                  !edge && !disabled && isSameDay(d, today) && "border border-primary/40 text-primary",
                )}
              >
                {d.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═════════════ Painel ═════════════ */

interface PanelProps {
  value: PeriodValue;
  onApply: (v: PeriodValue) => void;
  onClose: () => void;
  mobile: boolean;
}

function PeriodPanel({ value, onApply, onClose, mobile }: PanelProps) {
  const [draft, setDraft] = useState<PeriodValue>(value);
  const [from, setFrom] = useState<Date | null>(value.from);
  const [to, setTo] = useState<Date | null>(value.to);
  const [month, setMonth] = useState<Date>(startOfMonth(value.from ?? todayInSaoPaulo()));

  useEffect(() => {
    setDraft(value);
    setFrom(value.from);
    setTo(value.to);
    setMonth(startOfMonth(value.from ?? todayInSaoPaulo()));
  }, [value]);

  const days = from ? differenceInCalendarDays(to ?? from, from) + 1 : 0;

  const summary = from
    ? `${format(from, "dd MMM yyyy", { locale: ptBR })}${to ? ` → ${format(to, "dd MMM yyyy", { locale: ptBR })}` : ""}`
    : "Escolha uma data inicial";

  const choosePreset = (id: PeriodPresetId) => {
    const next = buildPeriod(id);
    setDraft(next);
    setFrom(next.from);
    setTo(next.to);
    setMonth(startOfMonth(next.from));
    onApply(next);
  };

  const pickDay = (d: Date) => {
    const day = startOfDay(d);
    // Primeiro clique (ou reinício após intervalo fechado) define o início.
    if (!from || (from && to)) {
      setFrom(day);
      setTo(null);
      setDraft({ presetId: null, from: day, to: day });
      return;
    }
    if (day < from) {
      setFrom(day);
      setTo(from);
      setDraft({ presetId: null, from: day, to: from });
      return;
    }
    setTo(day);
    setDraft({ presetId: null, from, to: day });
  };

  const applyCustom = () => {
    if (!from) return;
    onApply({ presetId: null, from: startOfDay(from), to: endOfDay(to ?? from) });
  };

  return (
    <div className={cn("flex flex-col", mobile ? "max-h-[88vh]" : "w-[min(600px,88vw)]")}>
      {/* Cabeçalho */}
      <div className={cn("flex items-start justify-between gap-3", mobile ? "px-5 pt-1 pb-4" : "px-5 pt-4 pb-3")}>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">Período de análise</p>
          <p className="mt-1 font-display text-[19px] font-bold leading-none tracking-[-0.03em] text-foreground">
            {periodLabel(draft)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {days > 0 && (
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-primary">
              {days}d
            </span>
          )}
          {mobile && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className={cn("flex-1 overflow-y-auto", mobile ? "px-5 pb-2" : "px-5 pb-4")}>
        <div className={cn(mobile ? "space-y-5" : "flex gap-5")}>
          {/* Presets */}
          <div className={cn(mobile ? "grid grid-cols-3 gap-2" : "grid w-[146px] shrink-0 grid-cols-1 gap-1.5")}>
            {PERIOD_PRESETS.map((p) => {
              const active = draft.presetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePreset(p.id)}
                  className={cn(
                    "relative flex flex-col justify-center overflow-hidden rounded-[12px] border px-3 text-left transition-colors",
                    mobile ? "h-[52px]" : "h-[40px]",
                    active
                      ? "border-primary/45 bg-primary/[0.12] text-primary"
                      : "border-border/50 bg-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  <span className="text-[12.5px] font-bold leading-none tracking-[-0.01em]">{p.label}</span>
                  {mobile && (
                    <span className="mt-1 truncate text-[10px] font-medium text-muted-foreground/55">{p.hint}</span>
                  )}
                  {active && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" strokeWidth={3} />}
                </button>
              );
            })}
          </div>

          {!mobile && <div className="w-px shrink-0 bg-border/50" />}

          {/* Calendário */}
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/55">
              Intervalo personalizado
            </p>
            <div className="rounded-[16px] border border-border/50 p-2.5">
              <MonthGrid
                month={month}
                onMonthChange={setMonth}
                from={from}
                to={to}
                onPick={pickDay}
                compact={!mobile}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ação */}
      <div
        className={cn(
          "flex items-center gap-3 border-t border-border/50 bg-card",
          mobile ? "px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3" : "px-5 py-3",
        )}
      >
        {!mobile && (
          <span className="min-w-0 truncate text-[11.5px] font-medium text-muted-foreground/70">{summary}</span>
        )}
        {!mobile && (
          <button type="button" onClick={onClose} className="ml-auto text-[12px] font-semibold text-muted-foreground/70 hover:text-foreground">
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={applyCustom}
          disabled={!from}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-[12px] bg-primary font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40",
            mobile ? "h-[52px] w-full text-[14px]" : "h-9 px-5 text-[12.5px]",
          )}
        >
          <CalendarDays className="h-4 w-4" />
          Aplicar período
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

  const handleApply = (v: PeriodValue) => {
    onChange(v);
    setOpen(false);
  };

  if (isMobile) {
    return (
      <>
        <span onClick={() => setOpen(true)} className="contents">{trigger}</span>
        <Sheet open={isOpen} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            hideClose
            className="rounded-t-[26px] border-x-0 border-b-0 border-t border-border/60 bg-card p-0 pt-3"
          >
            <SheetTitle className="sr-only">Selecionar período</SheetTitle>
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
            <PeriodPanel value={value} onApply={handleApply} onClose={() => setOpen(false)} mobile />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={10}
        collisionPadding={14}
        className="w-auto max-w-[92vw] rounded-[18px] border-border/60 bg-card p-0"
      >
        <PeriodPanel value={value} onApply={handleApply} onClose={() => setOpen(false)} mobile={false} />
      </PopoverContent>
    </Popover>
  );
}
