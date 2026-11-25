import { History } from "lucide-react";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { describeHistory, whenLabel, type HistoryItem } from "./settingsModel";

export function HistoryPanel({ items }: { items: HistoryItem[] }) {
  return (
    <PremiumPanel title="Últimas mudanças" icon={History}>
      {items.length === 0 ? (
        <p className="py-4 text-[13px] text-muted-foreground">Nenhuma mudança feita por aqui ainda. As próximas aparecem nesta lista, com o motivo.</p>
      ) : (
        <ol className="divide-y divide-border/50">
          {items.map((h) => {
            const l = describeHistory(h);
            return (
              <li key={h.id} className="py-3.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <p className="text-[14px] font-semibold text-foreground">{l.title}</p>
                  <p className="text-[12.5px] text-muted-foreground">{whenLabel(h.created_at)}{h.admin_name ? `, por ${h.admin_name}` : ""}</p>
                </div>
                {l.detail && <p className="mt-0.5 text-[13px] text-foreground/85">{l.detail}</p>}
                {l.reason && <p className="mt-0.5 break-words text-[13px] text-muted-foreground">Motivo: {l.reason}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </PremiumPanel>
  );
}
