import { Copy, MoreHorizontal, Pause, Pencil, Play, ShieldOff, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/seller-ui/tx";
import { SellerMenuItem, sellerMenuContent } from "@/components/seller-ui/menu";
import { cn } from "@/lib/utils";
import { KEY_STATE, ago, dateLabel, daysUntil, keyState, shortKey, type ApiKeyRow } from "./intMeta";

export interface KeysLedgerProps {
  keys: ApiKeyRow[];
  busyId: string | null;
  onCopy: (k: ApiKeyRow) => void;
  onRename: (k: ApiKeyRow) => void;
  onToggle: (k: ApiKeyRow) => void;
  onRevoke: (k: ApiKeyRow) => void;
  onDelete: (k: ApiKeyRow) => void;
}

const COLS = "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_120px_130px_150px_44px]";

function expiryText(k: ApiKeyRow, st: ReturnType<typeof keyState>): { text: string; warn: boolean } {
  if (!k.expires_at) return { text: "Sem validade", warn: false };
  if (st === "revoked") return { text: k.revoked_at ? `Revogada em ${dateLabel(k.revoked_at)}` : "Revogada", warn: false };
  const d = daysUntil(k.expires_at);
  if (d <= 0) return { text: `Expirou em ${dateLabel(k.expires_at)}`, warn: true };
  if (d <= 14) return { text: `Expira em ${d} ${d === 1 ? "dia" : "dias"}`, warn: true };
  return { text: dateLabel(k.expires_at), warn: false };
}

export function KeysLedger(p: KeysLedgerProps) {
  return (
    <section className="vp-sheet overflow-hidden" aria-label="Chaves de API">
      <div role="table" aria-label="Chaves de API">
        <div role="row" className={cn("hidden border-b border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground md:grid md:items-center md:gap-4", COLS)}>
          <span role="columnheader">Nome</span><span role="columnheader">Chave pública</span><span role="columnheader">Situação</span><span role="columnheader">Último uso</span><span role="columnheader">Validade</span><span role="columnheader" className="sr-only">Ações</span>
        </div>
        <ul>
          {p.keys.map((k) => {
            const st = keyState(k);
            const meta = KEY_STATE[st];
            const exp = expiryText(k, st);
            const dead = st === "revoked" || st === "expired";
            return (
              <li key={k.id} role="row" className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-t border-border px-5 py-4 first:border-t-0 sm:px-7 md:gap-4", COLS, p.busyId === k.id && "opacity-60", dead && "opacity-80")}>
                <span role="cell" className="col-start-1 row-start-1 min-w-0">
                  <span className="block truncate text-[14.5px] font-bold text-foreground">{k.name}</span>
                  <span className="block text-[12.5px] text-muted-foreground">Criada em {dateLabel(k.created_at)}</span>
                </span>
                <span role="cell" className="col-start-2 row-start-1 justify-self-end md:col-start-6">
                  <RowMenu k={k} st={st} {...p} />
                </span>
                <span role="cell" className="col-span-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
                  <button type="button" onClick={() => p.onCopy(k)} className="group inline-flex max-w-full items-center gap-2 rounded-[12px] bg-muted/60 px-3 py-1.5 text-left hover:bg-muted" aria-label={`Copiar a chave pública de ${k.name}`}>
                    <span className="truncate font-mono text-[12.5px] text-foreground/80">{shortKey(k.public_key)}</span>
                    <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  </button>
                  <span className="mt-1 block font-mono text-[11.5px] text-muted-foreground">Secreta {k.secret_key_prefix}••••</span>
                </span>
                <span role="cell" className="col-span-2 md:col-span-1 md:col-start-3 md:row-start-1"><StatusPill label={meta.label} tone={meta.tone} /></span>
                <span role="cell" className="col-span-2 flex justify-between gap-3 text-[13px] md:col-span-1 md:col-start-4 md:row-start-1 md:block">
                  <span className="text-muted-foreground md:hidden">Último uso</span>
                  <span className="font-medium text-foreground">{k.last_used_at ? ago(k.last_used_at) : "Nunca usada"}</span>
                </span>
                <span role="cell" className="col-span-2 flex justify-between gap-3 text-[13px] md:col-span-1 md:col-start-5 md:row-start-1 md:block">
                  <span className="text-muted-foreground md:hidden">Validade</span>
                  <span className={cn("font-medium", exp.warn ? "text-warning" : "text-foreground")}>{exp.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function RowMenu({ k, st, onCopy, onRename, onToggle, onRevoke, onDelete, busyId }: { k: ApiKeyRow; st: ReturnType<typeof keyState> } & KeysLedgerProps) {
  const canToggle = st === "active" || st === "paused";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="vp-orb h-10 w-10" aria-label={`Ações da chave ${k.name}`} disabled={busyId === k.id}><MoreHorizontal className="h-[18px] w-[18px]" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={16} className={cn(sellerMenuContent, "w-72")}>
        <SellerMenuItem icon={Copy} label="Copiar chave pública" onSelect={() => onCopy(k)} />
        <SellerMenuItem icon={Pencil} label="Renomear" onSelect={() => onRename(k)} />
        {canToggle && <SellerMenuItem icon={st === "paused" ? Play : Pause} label={st === "paused" ? "Reativar chave" : "Pausar chave"} onSelect={() => onToggle(k)} />}
        <DropdownMenuSeparator className="my-1.5" />
        {st !== "revoked" && <SellerMenuItem icon={ShieldOff} destructive label="Revogar para sempre" onSelect={() => onRevoke(k)} />}
        <SellerMenuItem icon={Trash2} destructive label="Excluir da lista" onSelect={() => onDelete(k)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
