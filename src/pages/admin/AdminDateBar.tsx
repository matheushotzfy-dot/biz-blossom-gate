/**
 * Período do topo do admin. No computador: atalhos em linha (Hoje … 1 ano) + botão do calendário;
 * no celular: um botão só com o período atual. Os dois abrem o mesmo `PeriodPicker` do painel do seller
 * (datas digitáveis, intervalo validado, folha inferior no celular). Quem sabe qual atalho está ativo é o
 * intervalo em si (`matchDatePreset`), então o destaque nunca fica para trás depois da meia-noite.
 */
import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { PeriodPicker } from "@/components/PeriodPicker";
import { periodLabel, todayInSaoPaulo } from "@/components/period/periodMeta";
import { useMinWidth } from "@/hooks/useMinWidth";
import { cn } from "@/lib/utils";
import { DATE_PRESETS, matchDatePreset, presetRange } from "./adminNav";

export interface AdminRange { from: Date; to: Date }

interface Props {
  range: AdminRange;
  onChange: (range: AdminRange) => void;
}

const LONG_LABEL: Record<string, string> = { today: "Hoje", yesterday: "Ontem", "7d": "7 dias", "14d": "14 dias", "30d": "30 dias", "40d": "40 dias", "90d": "90 dias", "180d": "180 dias", "365d": "1 ano" };

export default function AdminDateBar({ range, onChange }: Props) {
  // Os nove atalhos em linha só cabem do xl (1280px) para cima; abaixo disso vira um botão só.
  const wide = useMinWidth(1280);
  const [open, setOpen] = useState(false);
  const today = todayInSaoPaulo();
  const active = matchDatePreset(range, today);
  const label = active ? LONG_LABEL[active] : periodLabel({ presetId: null, from: range.from, to: range.to }, today);

  const picker = (trigger: React.ReactNode) => (
    <PeriodPicker
      open={open}
      onOpenChange={setOpen}
      value={{ presetId: null, from: range.from, to: range.to }}
      onChange={(v) => onChange({ from: v.from, to: v.to })}
      align="end"
      side="bottom"
      trigger={trigger}
    />
  );

  if (!wide) {
    return picker(
      <button
        type="button"
        aria-label={`Período: ${label}. Escolher outro`}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-md af-border border af-surface-2 px-2.5 text-[12.5px] font-semibold af-text"
      >
        <CalendarDays className="h-3.5 w-3.5 af-muted" />
        <span className="max-w-[112px] truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 af-muted" />
      </button>,
    );
  }

  return (
    <div role="group" aria-label="Período" className="flex items-center gap-px rounded-md af-surface-2 af-border border p-0.5">
      {DATE_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={active === p.id}
          onClick={() => onChange(presetRange(p.id, today))}
          className={cn(
            "shrink-0 rounded px-2.5 py-1.5 text-[12px] font-semibold transition-colors md:px-3",
            active === p.id ? "af-surface af-text af-border border" : "af-muted hover:af-text",
          )}
        >
          {p.label}
        </button>
      ))}
      {picker(
        <button
          type="button"
          aria-label={active ? "Escolher período personalizado" : `Período: ${label}. Escolher outro`}
          title="Período personalizado"
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded px-2 py-1.5 transition-colors",
            active ? "af-muted hover:af-text hover:af-surface" : "af-surface af-text af-border border",
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {!active && <span className="whitespace-nowrap text-[11.5px] font-semibold">{label}</span>}
        </button>,
      )}
    </div>
  );
}
