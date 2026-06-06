import {
  Copy,
  Crosshair,
  ExternalLink,
  MoreHorizontal,
  Palette,
  Pencil,
  Star,
  Trash2,
  ChevronRight,
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
import { formatCurrency } from "./productPresentation";

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

type Row = {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  action: () => void;
  variant?: "default" | "destructive";
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
  const groupManagement: Row[] = [
    { icon: Pencil,  label: "Editar produto",   shortcut: "E", action: () => onEditProduct(product) },
    { icon: Palette, label: "Checkout builder", shortcut: "B", action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`) },
    { icon: Star,    label: "Área de membros",  shortcut: "M", action: () => onOpenMembers(product) },
  ];

  const groupDistribution: Row[] = [
    ...(product.checkout_url
      ? [
          { icon: copied ? Copy : Copy, label: copied ? "Link copiado" : "Copiar checkout", shortcut: "C", action: () => onCopyLink(product) },
          { icon: ExternalLink, label: "Abrir checkout",       shortcut: "O", action: () => onOpenCheckout(product) },
        ]
      : []),
    { icon: Crosshair, label: "Pixels & tracking", shortcut: "P", action: () => onOpenPixels(product) },
  ];

  const labeledTrigger = Boolean(triggerLabel);

  const renderRow = (row: Row) => (
    <DropdownMenuItem
      key={row.label}
      onClick={row.action}
      className={cn(
        "group flex h-9 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium transition-all duration-200 outline-none",
        row.variant === "destructive"
          ? "text-destructive focus:bg-destructive/10 data-[highlighted]:bg-destructive/10"
          : "text-foreground/90 focus:bg-accent/80 focus:text-foreground data-[highlighted]:bg-accent/80 data-[highlighted]:text-foreground"
      )}
    >
      <div className={cn(
        "flex h-5 w-5 items-center justify-center rounded-md transition-colors",
        row.variant === "destructive" ? "text-destructive/80 group-hover:text-destructive" : "bg-primary/5 text-primary/70 group-hover:bg-primary/10 group-hover:text-primary"
      )}>
        <row.icon className="h-3.5 w-3.5" strokeWidth={2.2} />
      </div>
      
      <span className="flex-1 truncate tracking-tight">{row.label}</span>
      
      {row.shortcut ? (
        <kbd className="ml-auto hidden h-4.5 min-w-[18px] items-center justify-center rounded border border-border/60 bg-muted/40 px-1 font-mono text-[9px] font-bold text-muted-foreground/80 sm:inline-flex">
          {row.shortcut}
        </kbd>
      ) : (
        <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground/30 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
      )}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "group relative flex items-center justify-center rounded-xl border border-border/50 bg-card transition-all duration-300",
            labeledTrigger
              ? "h-10 gap-2 px-4 text-[12px] font-bold uppercase tracking-wider text-foreground/80 hover:border-primary/40 hover:bg-secondary/50 active:scale-[0.98]"
              : "h-10 w-10 text-muted-foreground/60 hover:border-primary/40 hover:bg-secondary/50 hover:text-foreground active:scale-95",
            triggerClassName,
          )}
        >
          <MoreHorizontal className={labeledTrigger ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.2} />
          {triggerLabel && <span className="font-display">{triggerLabel}</span>}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[240px] animate-in fade-in zoom-in-95 overflow-hidden rounded-2xl border border-border/60 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl"
      >
        {/* Compact Product Identity Header */}
        <div className="flex items-center gap-3 px-2 pb-2 pt-1.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/30 p-1">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="h-full w-full rounded-lg object-cover" />
            ) : (
              <Star className="h-4 w-4 text-muted-foreground/40" />
            )}
          </div>
          <div className="min-w-0 flex-1 flex flex-col">
            <span className="truncate text-[13px] font-bold leading-tight tracking-tight text-foreground">
              {product.name || "Sem nome"}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {formatCurrency(Number(product.price || 0))}
            </span>
          </div>
        </div>

        <DropdownMenuSeparator className="mx-1 my-1.5 bg-border/40" />

        <div className="space-y-0.5">
          {groupManagement.map(renderRow)}
        </div>

        <DropdownMenuSeparator className="mx-1 my-1.5 bg-border/40" />

        <div className="space-y-0.5">
          {groupDistribution.map(renderRow)}
        </div>

        <DropdownMenuSeparator className="mx-1 my-1.5 bg-border/40" />

        {renderRow({
          icon: Trash2,
          label: "Excluir produto",
          shortcut: "⌫",
          variant: "destructive",
          action: () => onDeleteProduct(product),
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
