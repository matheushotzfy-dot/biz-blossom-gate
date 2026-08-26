/**
 * PeriodPicker — seletor de período único da plataforma.
 *
 * Desktop: popover compacto (presets à esquerda, calendário à direita).
 * Mobile: bottom sheet com alça, presets em grade de toque (44px+),
 * calendário fluido e barra de ação fixa com safe-area.
 *
 * Fonte única de verdade para "Hoje / Ontem / 7d / 15d / 30d / Este mês
 * / intervalo personalizado" — usado no Dashboard e em Vendas.
 */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, Check, X } from "lucide-react";
import { differenceInCalendarDays, endOfDay, format, startOfDay, startOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
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

interface PanelProps {
  value: PeriodValue;
  onApply: (v: PeriodValue) => void;
  onClose: () => void;
  mobile: boolean;
}

function PeriodPanel({ value, onApply, onClose, mobile }: PanelProps) {
  const [draft, setDraft] = useState<PeriodValue>(value);
  const [range, setRange] = useState<DateRange | undefined>({ from: value.from, to: value.to });

  useEffect(() => {
    setDraft(value);
    setRange({ from: value.from, to: value.to });
  }, [value]);

  const days = useMemo(() => {
    if (!range?.from) return 0;
    return differenceInCalendarDays(range.to ?? range.from, range.from) + 1;
  }, [range]);

  const summary = range?.from
    ? `${format(range.from, "dd MMM yyyy", { locale: ptBR })}${range.to ? ` → ${format(range.to, "dd MMM yyyy", { locale: ptBR })}` : ""}`
    : "Escolha uma data inicial";

  const choosePreset = (id: PeriodPresetId) => {
    const next = buildPeriod(id);
    setDraft(next);
    setRange({ from: next.from, to: next.to });
    onApply(next);
  };

  const applyCustom = () => {
    if (!range?.from) return;
    onApply({ presetId: null, from: startOfDay(range.from), to: endOfDay(range.to ?? range.from) });
  };

  return (
    <div className={cn("flex flex-col", mobile ? "max-h-[86vh]" : "w-[560px]")}>
      {/* Cabeçalho */}
      <div className={cn("flex items-start justify-between gap-3", mobile ? "px-5 pt-1 pb-4" : "px-5 pt-4 pb-3")}>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">Período de análise</p>
          <p className="mt-1 font-display text-[19px] font-bold leading-none tracking-[-0.03em] text-foreground">
            {periodLabel(draft)}
          </p>
          <p className="mt-1.5 truncate text-[12px] text-muted-foreground/60">{summary}</p>
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
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className={cn("flex-1 overflow-y-auto", mobile ? "px-5 pb-2" : "px-5 pb-4")}>
        <div className={cn(mobile ? "space-y-5" : "flex gap-5")}>
          {/* Presets */}
          <div className={cn(mobile ? "grid grid-cols-3 gap-2" : "grid w-[150px] shrink-0 grid-cols-1 gap-1.5")}>
            {PERIOD_PRESETS.map((p) => {
              const active = draft.presetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePreset(p.id)}
                  className={cn(
                    "group relative flex flex-col justify-center overflow-hidden rounded-[14px] border text-left transition-colors",
                    mobile ? "h-[54px] px-3 active:scale-[0.97]" : "h-[42px] px-3",
                    active
                      ? "border-primary/50 bg-primary/12 text-foreground"
                      : "border-border/50 bg-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  <span className={cn("text-[13px] font-bold leading-none tracking-[-0.01em]", active && "text-primary")}>
                    {p.label}
                  </span>
                  {mobile && (
                    <span className="mt-1 truncate text-[10px] font-medium text-muted-foreground/55">{p.hint}</span>
                  )}
                  {active && (
                    <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" strokeWidth={3} />
                  )}
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
            <div className="rounded-[16px] border border-border/50 p-1.5">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => {
                  setRange(r);
                  if (r?.from) setDraft({ presetId: null, from: r.from, to: r.to ?? r.from });
                }}
                defaultMonth={range?.from ?? new Date()}
                locale={ptBR}
                showOutsideDays={false}
                className="pointer-events-auto w-full p-1"
                classNames={{
                  months: "flex w-full flex-col",
                  month: "w-full space-y-3",
                  table: "w-full border-collapse",
                  head_row: "flex w-full",
                  head_cell:
                    "flex-1 text-muted-foreground/45 font-display font-bold text-[9.5px] uppercase tracking-[0.14em] flex items-center justify-center h-6",
                  row: "flex w-full mt-1",
                  cell: cn(
                    "relative flex-1 p-0 text-center tabular-nums",
                    mobile ? "h-11 text-[13.5px]" : "h-9 text-[12.5px]",
                    "[&:has([aria-selected])]:bg-primary/[0.07]",
                    "first:[&:has([aria-selected])]:rounded-l-[10px] last:[&:has([aria-selected])]:rounded-r-[10px]",
                  ),
                  day: cn(
                    "mx-auto flex items-center justify-center rounded-[10px] font-display font-semibold tabular-nums text-foreground/85 transition-colors hover:bg-secondary/60",
                    mobile ? "h-11 w-11" : "h-9 w-9",
                  ),
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ação */}
      <div
        className={cn(
          "flex items-center gap-3 border-t border-border/50 bg-card/60 backdrop-blur",
          mobile ? "px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3" : "px-5 py-3",
        )}
      >
        {!mobile && (
          <button type="button" onClick={onClose} className="text-[12px] font-semibold text-muted-foreground/70 hover:text-foreground">
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={applyCustom}
          disabled={!range?.from}
          className={cn(
            "ml-auto inline-flex items-center justify-center gap-2 rounded-[14px] bg-primary font-bold text-primary-foreground transition-transform disabled:opacity-40",
            mobile ? "h-[52px] w-full text-[14px] active:scale-[0.98]" : "h-9 px-5 text-[12.5px]",
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
        className="w-auto rounded-[18px] border-border/60 p-0"
      >
        <PeriodPanel value={value} onApply={handleApply} onClose={() => setOpen(false)} mobile={false} />
      </PopoverContent>
    </Popover>
  );
}
