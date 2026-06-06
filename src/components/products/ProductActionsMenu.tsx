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
    { icon: Pencil,  label: "Editar produto",   action: () => onEditProduct(product) },
    { icon: Palette, label: "Checkout builder", action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`) },
    { icon: Star,    label: "Área de membros",  action: () => onOpenMembers(product) },
  ];

  const groupDistribution: Row[] = [
    ...(product.checkout_url
      ? [
          { icon: copied ? Copy : Copy, label: copied ? "Link copiado" : "Copiar checkout", action: () => onCopyLink(product) },
          { icon: ExternalLink, label: "Abrir checkout",       action: () => onOpenCheckout(product) },
        ]
      : []),
    { icon: Crosshair, label: "Pixels & tracking", action: () => onOpenPixels(product) },
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
          : "text-foreground/90 focus:bg-secondary/80 focus:text-foreground data-[highlighted]:bg-secondary/80 data-[highlighted]:text-foreground"
      )}
    >
      <div className={cn(
        "flex h-5 w-5 items-center justify-center rounded-md transition-colors",
        row.variant === "destructive" ? "text-destructive/80 group-hover:text-destructive" : "text-muted-foreground/60 group-hover:text-foreground group-data-[highlighted]:text-foreground"
      )}>
        <row.icon className="h-3.5 w-3.5" strokeWidth={2} />
      </div>
      
      <span className="flex-1 truncate tracking-tight">{row.label}</span>
      
      <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground/30 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-data-[highlighted]:opacity-100" />
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "group relative flex items-center justify-center rounded-xl border border-border/40 bg-card/50 transition-all duration-300",
            labeledTrigger
              ? "h-10 gap-2 px-4 text-[12px] font-bold uppercase tracking-wider text-foreground/80 hover:border-primary/40 hover:bg-card active:scale-[0.98]"
              : "h-10 w-10 text-muted-foreground/60 hover:border-primary/40 hover:bg-card hover:text-foreground active:scale-95 shadow-sm",
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
        className="w-[220px] animate-in fade-in zoom-in-95 overflow-hidden rounded-2xl border border-border/40 bg-card p-1.5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] backdrop-blur-md"
      >
        {/* Identity Header */}
        <div className="flex items-center gap-3 px-2 pb-2 pt-1.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/20 bg-muted/20 p-1">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="h-full w-full rounded object-cover" />
            ) : (
              <Star className="h-3.5 w-3.5 text-muted-foreground/40" />
            )}
          </div>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <span className="truncate text-[12px] font-bold tracking-tight text-foreground">
              {product.name || "Sem nome"}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground/60">
              {formatCurrency(Number(product.price || 0))}
            </span>
          </div>
        </div>

        <DropdownMenuSeparator className="mx-1 my-1.5 bg-border/20" />

        <div className="space-y-0.5">
          {groupManagement.map(renderRow)}
        </div>

        <DropdownMenuSeparator className="mx-1 my-1.5 bg-border/20" />

        <div className="space-y-0.5">
          {groupDistribution.map(renderRow)}
        </div>

        <DropdownMenuSeparator className="mx-1 my-1.5 bg-border/20" />

        {renderRow({
          icon: Trash2,
          label: "Excluir produto",
          variant: "destructive",
          action: () => onDeleteProduct(product),
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
