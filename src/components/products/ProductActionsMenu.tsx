import {
  ArrowUpRight,
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
  hint: string;
  action: () => void;
  shortcut?: string;
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
    { icon: Pencil, label: "Editar produto", hint: "Detalhes, oferta e preço", action: () => onEditProduct(product) },
    { icon: Palette, label: "Checkout builder", hint: "Layout, cores e temas", action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`) },
    ...(product.checkout_url
      ? [
          {
            icon: copied ? CheckCircle2 : Copy,
            label: copied ? "Link copiado" : "Copiar link do checkout",
            hint: copied ? "Pronto para compartilhar" : "URL pública do produto",
            action: () => onCopyLink(product),
          },
          { icon: ExternalLink, label: "Abrir checkout", hint: "Visualizar como cliente", action: () => onOpenCheckout(product) },
        ]
      : []),
    { icon: Crosshair, label: "Pixels & tracking", hint: "Meta, Google, TikTok, Kwai", action: () => onOpenPixels(product) },
    { icon: Star, label: "Área de membros", hint: "Conteúdo e alunos", action: () => onOpenMembers(product) },
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
        className="w-[300px] overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-none animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-secondary/60">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary" strokeWidth={2.25} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[13.5px] font-black tracking-tight text-foreground">
              {product.name || "Produto sem nome"}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-primary" />
              <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                Ações rápidas
              </p>
            </div>
          </div>
        </div>

        {/* Action items — clean list, hover indicator */}
        <div className="p-1">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.label}
              onClick={item.action}
              className="group/item relative cursor-pointer gap-3 rounded-xl px-3 py-2.5 transition-all focus:bg-accent/50 data-[highlighted]:bg-accent/50"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-secondary/40 text-foreground/70 transition-all group-hover/item:border-primary/40 group-hover/item:bg-primary/[0.06] group-hover/item:text-primary">
                <item.icon className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[12.5px] font-bold tracking-tight text-foreground">{item.label}</p>
                <p className="mt-0.5 truncate text-[10.5px] font-medium text-muted-foreground/65">{item.hint}</p>
              </div>
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-muted-foreground/0 transition-all group-hover/item:translate-x-0 group-hover/item:text-primary"
                strokeWidth={2.25}
              />
            </DropdownMenuItem>
          ))}
        </div>

        {/* Delete — segregated zone */}
        <div className="border-t border-border/60 bg-muted/[0.15] p-1">
          <DropdownMenuItem
            onClick={() => onDeleteProduct(product)}
            className="group/del cursor-pointer gap-3 rounded-xl px-3 py-2.5 transition-all focus:bg-destructive/10 data-[highlighted]:bg-destructive/10"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/[0.08] text-destructive transition-all group-hover/del:border-destructive/60 group-hover/del:bg-destructive/[0.14]">
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
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
