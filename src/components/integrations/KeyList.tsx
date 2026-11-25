import { Copy, MoreHorizontal, Pause, Pencil, Play, Repeat2, ShieldOff, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/seller-ui/tx";
import { SellerMenuItem, sellerMenuContent } from "@/components/seller-ui/menu";
import { cn } from "@/lib/utils";
import { KeyRing } from "./KeyRing";
import { KEY_STATE, ago, dateShort, daysUntil, keyAttention, keyState, shortKey, type ApiKeyRow, type KeyState } from "./intMeta";

export interface KeyListProps {
  keys: ApiKeyRow[];
  busyId: string | null;
  /** Chave que acabou de ser substituída: a linha pergunta se já pode revogar. */
  swapId: string | null;
  onCopy: (k: ApiKeyRow) => void;
  onRename: (k: ApiKeyRow) => void;
  onSwap: (k: ApiKeyRow) => void;
  onToggle: (k: ApiKeyRow) => void;
  onRevoke: (k: ApiKeyRow) => void;
  onDelete: (k: ApiKeyRow) => void;
  onDismissSwap: () => void;
}

/** "há 8 h" durante a primeira semana; depois a data curta. */
function lastUsedText(iso: string | null): string {
  if (!iso) return "Nunca usada";
  return Date.now() - new Date(iso).getTime() < 8 * 86_400_000 ? ago(iso) : dateShort(iso);
}

function validity(k: ApiKeyRow, st: KeyState): { text: string; warn: boolean } {
  if (st === "revoked") return { text: k.revoked_at ? `Revogada em ${dateShort(k.revoked_at)}` : "Revogada", warn: false };
  if (!k.expires_at) return { text: "Sem validade", warn: false };
  const d = daysUntil(k.expires_at);
  if (d <= 0) return { text: `Expirou em ${dateShort(k.expires_at)}`, warn: true };
  if (st === "active" && d <= 14) return { text: `Vence em ${d} ${d === 1 ? "dia" : "dias"}`, warn: true };
  return { text: `Até ${dateShort(k.expires_at)}`, warn: false };
}

export function KeyList(p: KeyListProps) {
  return (
    <ul className="space-y-3" aria-label="Chaves de API">
      {p.keys.map((k) => <KeyCard key={k.id} k={k} {...p} />)}
    </ul>
  );
}

function KeyCard({ k, ...p }: { k: ApiKeyRow } & KeyListProps) {
  const st = keyState(k);
  const meta = KEY_STATE[st];
  const val = validity(k, st);
  const attention = keyAttention(k);
  const swapping = p.swapId === k.id && st !== "revoked";
  const quiet = st === "revoked";

  return (
    <li className={cn("vp-sheet overflow-hidden transition-opacity", p.busyId === k.id && "opacity-60", quiet && "opacity-85")}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-4 px-5 py-5 sm:px-6 lg:grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-x-6">
        <KeyRing k={k} state={st} />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="min-w-0 max-w-full truncate text-[16.5px] font-extrabold tracking-[-0.02em] text-foreground">{k.name}</h3>
            <StatusPill label={meta.label} tone={meta.tone} />
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">Criada em {dateShort(k.created_at)}</p>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button" onClick={() => p.onCopy(k)}
              className="group inline-flex max-w-full items-center gap-2 rounded-[12px] bg-muted/70 px-3 py-1.5 text-left hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={`Copiar a chave pública de ${k.name}`}
            >
              <span className="truncate font-mono text-[12.5px] text-foreground/85">{shortKey(k.public_key)}</span>
              <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
            </button>
            <span className="font-mono text-[12px] text-muted-foreground" title="Só o começo da chave secreta. Ela inteira aparece uma vez, na criação.">{k.secret_key_prefix}••••••</span>
          </div>
        </div>

        <div className="col-start-3 row-start-1 lg:col-start-4"><RowMenu k={k} st={st} {...p} /></div>

        <dl className="col-span-3 row-start-2 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-4 gap-y-3 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:grid-cols-[minmax(0,1fr)]">
          <div>
            <dt className="text-[12.5px] text-muted-foreground">Último uso</dt>
            <dd className="mt-0.5 text-[14px] font-semibold text-foreground">{lastUsedText(k.last_used_at)}</dd>
          </div>
          <div>
            <dt className="text-[12.5px] text-muted-foreground">Validade</dt>
            <dd className={cn("mt-0.5 text-[14px] font-semibold", val.warn ? "text-warning" : "text-foreground")}>{val.text}</dd>
          </div>
        </dl>
      </div>

      {swapping ? (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-accent px-5 py-3 sm:px-6">
          <p className="min-w-0 flex-1 basis-64 text-[13.5px] font-medium leading-snug text-accent-foreground">A chave nova já existe. Troque no seu sistema e depois revogue esta, para fechar a troca.</p>
          <div className="flex gap-2">
            <button type="button" className="vp-ghost !h-10" onClick={p.onDismissSwap}>Depois</button>
            <button type="button" className="vp-cta vp-cta-danger !h-10" onClick={() => p.onRevoke(k)}>Revogar esta</button>
          </div>
        </div>
      ) : attention && (
        <div className={cn("flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6", attention === "expired" ? "bg-destructive/10" : "bg-warning/15")}>
          <p className={cn("min-w-0 flex-1 basis-64 text-[13.5px] font-medium leading-snug", attention === "expired" ? "text-destructive" : "text-warning")}>
            {attention === "expired" ? "Esta chave não autentica mais. Crie uma nova e troque no seu sistema." : "Esta chave vence logo. Crie a nova antes, para o seu sistema não ficar sem chave."}
          </p>
          <button type="button" className="vp-ghost !h-10" onClick={() => p.onSwap(k)}><Repeat2 className="h-4 w-4" />Trocar chave</button>
        </div>
      )}
    </li>
  );
}

function RowMenu({ k, st, busyId, onCopy, onRename, onSwap, onToggle, onRevoke, onDelete }: { k: ApiKeyRow; st: KeyState } & KeyListProps) {
  const canToggle = st === "active" || st === "paused";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="vp-orb h-10 w-10" aria-label={`Ações da chave ${k.name}`} disabled={busyId === k.id}><MoreHorizontal className="h-[18px] w-[18px]" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={16} className={cn(sellerMenuContent, "w-72")}>
        <SellerMenuItem icon={Copy} label="Copiar chave pública" onSelect={() => onCopy(k)} />
        <SellerMenuItem icon={Pencil} label="Renomear" onSelect={() => onRename(k)} />
        {st !== "revoked" && <SellerMenuItem icon={Repeat2} label="Trocar por uma nova" onSelect={() => onSwap(k)} />}
        {canToggle && <SellerMenuItem icon={st === "paused" ? Play : Pause} label={st === "paused" ? "Reativar chave" : "Pausar chave"} onSelect={() => onToggle(k)} />}
        <DropdownMenuSeparator className="my-1.5" />
        {st !== "revoked" && <SellerMenuItem icon={ShieldOff} destructive label="Revogar para sempre" onSelect={() => onRevoke(k)} />}
        <SellerMenuItem icon={Trash2} destructive label="Excluir da lista" onSelect={() => onDelete(k)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
