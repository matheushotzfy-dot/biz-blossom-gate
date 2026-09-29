import { Check, Copy, ExternalLink, Link2, Pencil, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn, formatCurrency } from "@/lib/utils";
import type { PaymentLink } from "./types";

interface PaymentLinkListProps {
  links: PaymentLink[];
  loading: boolean;
  copiedId: string | null;
  onCopy: (link: PaymentLink) => void;
  onEdit: (link: PaymentLink) => void;
  onToggle: (link: PaymentLink) => void;
  onRemove: (link: PaymentLink) => void;
}

function statusFor(link: PaymentLink) {
  if (link.archived_at) return { label: "Arquivado", tone: "bg-muted text-muted-foreground" };
  if (link.admin_status === "blocked") return { label: "Bloqueado", tone: "bg-destructive/10 text-destructive" };
  if (link.admin_status === "review") return { label: "Em revisão", tone: "bg-warning/10 text-warning" };
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return { label: "Expirado", tone: "bg-warning/10 text-warning" };
  if (link.max_uses && link.current_uses >= link.max_uses) return { label: "Esgotado", tone: "bg-warning/10 text-warning" };
  if (!link.is_active) return { label: "Pausado", tone: "bg-muted text-muted-foreground" };
  return { label: "Ativo", tone: "bg-primary/10 text-primary" };
}

export function PaymentLinkList({ links, loading, copiedId, onCopy, onEdit, onToggle, onRemove }: PaymentLinkListProps) {
  if (loading) return <div className="px-6 py-16 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (links.length === 0) return <div className="px-6 py-16 text-center"><Link2 className="mx-auto h-10 w-10 text-foreground/10" /><p className="mt-4 font-display font-bold">Nenhum link encontrado</p><p className="mt-1 text-sm text-muted-foreground">Crie um link ou ajuste os filtros.</p></div>;

  return <ul className="divide-y divide-border/40">{links.map((link) => {
    const status = statusFor(link);
    const locked = link.admin_status === "blocked" || Boolean(link.archived_at);
    return <li key={link.id} className="px-4 py-4 transition-colors hover:bg-muted/20 sm:px-6">
      <div className="flex items-start gap-4">
        {link.cover_url ? <img src={link.cover_url} alt="" className="h-14 w-14 rounded-xl border border-border/50 object-cover sm:h-16 sm:w-16" /> : <div className="grid h-14 w-14 place-items-center rounded-xl border border-border/50 bg-muted/30 sm:h-16 sm:w-16"><Link2 className="h-5 w-5 text-foreground/20" /></div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate font-display text-[15px] font-bold">{link.title}</h4><span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", status.tone)}>{status.label}</span></div><p className="mt-1 text-xs text-muted-foreground">{formatCurrency(Number(link.amount))} · {link.clicks} cliques · {link.current_uses}{link.max_uses ? `/${link.max_uses}` : ""} pagamentos</p></div><div className="hidden text-right sm:block"><p className="text-xs text-muted-foreground">Receita</p><p className="font-display text-base font-bold tabular-nums">{formatCurrency(Number(link.total_revenue))}</p></div></div>
          {link.admin_status === "blocked" && link.admin_block_reason && <p className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">Motivo: {link.admin_block_reason}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={() => onCopy(link)} className="min-w-0 flex-1 justify-start rounded-xl font-mono text-xs"><>{copiedId === link.id ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}<span className="truncate">/pl/{link.slug}</span></></Button><Switch checked={link.is_active} disabled={locked} onCheckedChange={() => onToggle(link)} aria-label={link.is_active ? `Pausar ${link.title}` : `Ativar ${link.title}`} /><Button size="icon" variant="ghost" onClick={() => onEdit(link)} disabled={Boolean(link.archived_at)} title="Editar"><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => window.open(`/pl/${link.slug}`, "_blank", "noopener,noreferrer")} title="Abrir"><ExternalLink className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => onRemove(link)} title={link.current_uses > 0 ? "Arquivar" : "Remover"}><Trash2 className="h-4 w-4" /></Button></div>
        </div>
      </div>
    </li>;
  })}</ul>;
}