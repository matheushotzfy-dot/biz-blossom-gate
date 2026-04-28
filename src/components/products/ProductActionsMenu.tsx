import {
  CheckCircle2,
  Copy,
  Crosshair,
  ExternalLink,
  MoreHorizontal,
  Palette,
  Pencil,
  Sparkles,
  Star,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { Product } from "./productPresentation";

export type ProductMenuHandlers = {
  onCopyLink: (product: Product) => void;
  onOpenCheckout: (product: Product) => void;
  onOpenPixels: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onOpenMembers: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
};

type ProductActionsMenuProps = ProductMenuHandlers & {
  copied: boolean;
  product: Product;
  triggerClassName?: string;
  triggerLabel?: string;
};

type ActionItem = {
  icon: LucideIcon;
  label: string;
  hint?: string;
  action: () => void;
  tone: "primary" | "info" | "success" | "warning" | "neutral";
};

const TONE_STYLES: Record<ActionItem["tone"], { wrap: string; icon: string }> = {
  primary: { wrap: "border-primary/25 bg-primary/[0.08]", icon: "text-primary" },
  info: { wrap: "border-sky-500/25 bg-sky-500/[0.08]", icon: "text-sky-400" },
  success: { wrap: "border-success/25 bg-success/[0.08]", icon: "text-success" },
  warning: { wrap: "border-warning/25 bg-warning/[0.08]", icon: "text-warning" },
  neutral: { wrap: "border-border/60 bg-secondary", icon: "text-foreground/70" },
};

export function ProductActionsMenu({
  copied,
  product,
  triggerClassName,
  triggerLabel,
  onCopyLink,
  onDeleteProduct,
  onEditProduct,
  onOpenCheckout,
  onOpenMembers,
  onOpenPixels,
}: ProductActionsMenuProps) {
  const items: ActionItem[] = [
    { icon: Pencil, label: "Editar produto", hint: "Detalhes & oferta", action: () => onEditProduct(product), tone: "primary" },
    { icon: Palette, label: "Checkout builder", hint: "Layout & temas", action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`), tone: "info" },
    ...(product.checkout_url
      ? [
          {
            icon: copied ? CheckCircle2 : Copy,
            label: copied ? "Link copiado!" : "Copiar link",
            hint: copied ? "Pronto para compartilhar" : "Checkout público",
            action: () => onCopyLink(product),
            tone: (copied ? "success" : "neutral") as ActionItem["tone"],
          },
          { icon: ExternalLink, label: "Abrir checkout", hint: "Visualizar como cliente", action: () => onOpenCheckout(product), tone: "neutral" as ActionItem["tone"] },
        ]
      : []),
    { icon: Crosshair, label: "Pixels & tracking", hint: "Meta, Google, TikTok…", action: () => onOpenPixels(product), tone: "warning" },
    { icon: Star, label: "Área de membros", hint: "Conteúdo & alunos", action: () => onOpenMembers(product), tone: "info" },
  ];

  const labeledTrigger = Boolean(triggerLabel);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            labeledTrigger
              ? "inline-flex h-10 min-w-[108px] items-center justify-center gap-2 rounded-lg border border-border/60 bg-card px-3 text-[11.5px] font-semibold text-foreground/80 transition-colors hover:border-primary/30 hover:text-foreground"
              : "flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground/60 transition-colors hover:border-primary/30 hover:text-foreground",
            triggerClassName
          )}
        >
          <MoreHorizontal className={labeledTrigger ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.8} />
          {triggerLabel && <span>{triggerLabel}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={10}
        collisionPadding={16}
        className="w-[288px] overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-none"
      >
        {/* Product header */}
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-secondary/60 via-card to-card px-4 pb-3.5 pt-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-50"
            style={{
              background: "radial-gradient(50% 50% at 50% 50%, hsl(var(--primary) / 0.18), transparent 70%)",
            }}
          />
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="h-full w-full rounded-[10px] object-cover" />
              ) : (
                <Sparkles className="h-4 w-4 text-primary" strokeWidth={2.25} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[13.5px] font-black tracking-tight text-foreground">
                {product.name || "Produto sem nome"}
              </p>
              <p className="mt-0.5 text-[9.5px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">
                Ações rápidas
              </p>
            </div>
          </div>
        </div>

        {/* Action items */}
        <div className="space-y-0.5 p-1.5">
          {items.map((item) => {
            const tone = TONE_STYLES[item.tone];
            return (
              <DropdownMenuItem
                key={item.label}
                onClick={item.action}
                className="group/item cursor-pointer gap-3 rounded-xl px-2.5 py-2 transition-all focus:bg-accent/60 data-[highlighted]:bg-accent/60"
              >
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-transform group-hover/item:scale-105", tone.wrap)}>
                  <item.icon className={cn("h-4 w-4", tone.icon)} strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[12.5px] font-bold tracking-tight text-foreground">{item.label}</p>
                  {item.hint && (
                    <p className="mt-0.5 truncate text-[10.5px] font-medium text-muted-foreground/70">{item.hint}</p>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator className="mx-3 my-0 bg-border/60" />

        {/* Delete action */}
        <div className="p-1.5">
          <DropdownMenuItem
            onClick={() => onDeleteProduct(product)}
            className="group/del cursor-pointer gap-3 rounded-xl px-2.5 py-2 transition-all focus:bg-destructive/10 data-[highlighted]:bg-destructive/10"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/[0.08] transition-transform group-hover/del:scale-105">
              <Trash2 className="h-4 w-4 text-destructive" strokeWidth={2.1} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[12.5px] font-bold tracking-tight text-destructive">Excluir produto</p>
              <p className="mt-0.5 text-[10.5px] font-medium text-destructive/60">Ação irreversível</p>
            </div>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
