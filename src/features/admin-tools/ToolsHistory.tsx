import { History } from "lucide-react";
import { PremiumEmpty } from "@/pages/admin/tabs/AdminPremium";
import { dateLabel, historyEntry, type HistoryItem } from "./toolsModel";

/** O que a equipe fez nas ferramentas (pausas, notas e exportações), do mais recente para o mais antigo. */
export function ToolsHistory({ history }: { history: HistoryItem[] }) {
  if (history.length === 0) return <PremiumEmpty icon={History} title="Nada registrado ainda" subtitle="Pausar, liberar, exportar ou anotar aparece aqui." />;
  return (
    <ol className="space-y-4 border-l border-border pl-4" aria-label="Histórico das ferramentas">
      {history.map((h, i) => {
        const e = historyEntry(h);
        return (
          <li key={`${h.at}-${i}`} className="relative">
            <span aria-hidden className="absolute -left-[21px] top-[7px] h-2 w-2 rounded-full bg-primary" />
            <p className="text-[14px] font-semibold text-foreground">{e.title}</p>
            <p className="text-[12.5px] text-muted-foreground">{dateLabel(h.at)}{h.by ? `, ${h.by}` : ""}</p>
            {e.text && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] text-foreground/85">{e.text}</p>}
          </li>
        );
      })}
    </ol>
  );
}
