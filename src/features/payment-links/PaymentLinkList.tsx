import { Check, Copy, ExternalLink, Eye, Link2, Pencil, ShoppingBag, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Money } from "@/components/home/Money";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { StatusPill } from "@/components/seller-ui/tx";
import type { TxTone } from "@/components/seller-ui/txMeta";
import type { PaymentLink } from "./types";

interface PaymentLinkListProps {
  links: PaymentLink[];
  loading: boolean;
  /** O vendedor já criou algum link? Define se o vazio é "comece aqui" ou "nada nesse filtro". */
  hasAny: boolean;
  copiedId: string | null;
  onCopy: (link: PaymentLink) => void;
  onEdit: (link: PaymentLink) => void;
  onToggle: (link: PaymentLink) => void;
  onRemove: (link: PaymentLink) => void;
  onCreate: () => void;
  onClearFilters: () => void;
}

function statusFor(link: PaymentLink): { label: string; tone: TxTone } {
  if (link.archived_at) return { label: "Arquivado", tone: "idle" };
  if (link.admin_status === "blocked") return { label: "Bloqueado", tone: "alert" };
  if (link.admin_status === "review") return { label: "Em revisão", tone: "wait" };
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return { label: "Expirado", tone: "wait" };
  if (link.max_uses && link.current_uses >= link.max_uses) return { label: "Esgotado", tone: "wait" };
  if (!link.is_active) return { label: "Pausado", tone: "idle" };
  return { label: "Ativo", tone: "ok" };
}

const iconBtn = "grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40";

export function PaymentLinkList({ links, loading, hasAny, copiedId, onCopy, onEdit, onToggle, onRemove, onCreate, onClearFilters }: PaymentLinkListProps) {
  if (loading && links.length === 0) return <div className="space-y-3 border-t border-border px-5 py-5 sm:px-7">{Array.from({ length: 4 }, (_, i) => <div key={i} className="vp-skel h-24" />)}</div>;

  if (links.length === 0) {
    return (
      <div className="border-t border-border">
        {hasAny ? (
          <EmptyPanel icon={<Link2 className="h-7 w-7" />} title="Nenhum link encontrado" text="Troque o filtro ou o termo da busca para ver outros links." action={<button type="button" className="vp-ghost" onClick={onClearFilters}>Limpar filtros</button>} />
        ) : (
          <EmptyPanel icon={<Link2 className="h-7 w-7" />} title="Cobre sem precisar de loja" text="Crie um link com valor e descrição, envie por WhatsApp ou redes sociais e receba por Pix ou cartão." action={<button type="button" className="vp-cta" onClick={onCreate}>Criar o primeiro link</button>} />
        )}
      </div>
    );
  }

  return (
    <ul className="border-t border-border">
      {links.map((link) => {
        const status = statusFor(link);
        const locked = link.admin_status === "blocked" || Boolean(link.archived_at);
        return (
          <li key={link.id} className="border-t border-border px-5 py-5 first:border-t-0 sm:px-7">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:items-center lg:gap-x-6">
              {link.cover_url ? (
                <img src={link.cover_url} alt="" className="h-16 w-16 rounded-2xl border border-border object-cover" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-accent-foreground"><Link2 className="h-6 w-6" /></span>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h3 className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-foreground">{link.title}</h3>
                  <StatusPill label={status.label} tone={status.tone} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13.5px] text-muted-foreground">
                  <Money value={Number(link.amount)} className="text-[15px] font-extrabold tracking-[-0.02em] text-foreground" centsClassName="opacity-60" />
                  <span className="inline-flex items-center gap-1.5"><Eye className="h-4 w-4" />{link.clicks.toLocaleString("pt-BR")} {link.clicks === 1 ? "clique" : "cliques"}</span>
                  <span className="inline-flex items-center gap-1.5"><ShoppingBag className="h-4 w-4" />{link.current_uses}{link.max_uses ? ` de ${link.max_uses}` : ""} {link.current_uses === 1 && !link.max_uses ? "pagamento" : "pagamentos"}</span>
                </div>
                <p className="mt-1.5 truncate font-mono text-[12.5px] text-muted-foreground">/pl/{link.slug}</p>
              </div>

              <div className="col-span-2 flex items-baseline justify-between border-t border-border pt-4 lg:col-span-1 lg:block lg:border-0 lg:pt-0 lg:text-right">
                <p className="text-[13px] text-muted-foreground">Receita</p>
                <Money value={Number(link.total_revenue)} className="text-[19px] font-extrabold tracking-[-0.03em] text-foreground" centsClassName="opacity-60" />
              </div>

              <div className="col-span-2 flex items-center gap-1 lg:col-span-1 lg:justify-end">
                <button type="button" onClick={() => onCopy(link)} className="vp-ghost !h-10 !px-4 text-[13.5px]">
                  {copiedId === link.id ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  {copiedId === link.id ? "Copiado" : "Copiar link"}
                </button>
                <span className="mx-2"><Switch checked={link.is_active} disabled={locked} onCheckedChange={() => onToggle(link)} aria-label={link.is_active ? `Pausar ${link.title}` : `Ativar ${link.title}`} /></span>
                <button type="button" className={iconBtn} onClick={() => onEdit(link)} disabled={Boolean(link.archived_at)} aria-label={`Editar ${link.title}`} title="Editar"><Pencil className="h-[18px] w-[18px]" /></button>
                <button type="button" className={iconBtn} onClick={() => window.open(`/pl/${link.slug}`, "_blank", "noopener,noreferrer")} aria-label={`Abrir ${link.title}`} title="Abrir página"><ExternalLink className="h-[18px] w-[18px]" /></button>
                <button type="button" className={`${iconBtn} hover:!bg-destructive/10 hover:!text-destructive`} onClick={() => onRemove(link)} aria-label={link.current_uses > 0 ? `Arquivar ${link.title}` : `Remover ${link.title}`} title={link.current_uses > 0 ? "Arquivar" : "Remover"}><Trash2 className="h-[18px] w-[18px]" /></button>
              </div>
            </div>
            {link.admin_status === "blocked" && link.admin_block_reason && (
              <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive">Motivo do bloqueio: {link.admin_block_reason}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
