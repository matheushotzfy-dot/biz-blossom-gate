import {
  CheckCircle2,
  Copy,
  Crosshair,
  ExternalLink,
  MoreHorizontal,
  Palette,
  Settings2,
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
  action: () => void;
  iconColor?: string;
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
    { icon: Settings2, label: "Editar produto", action: () => onEditProduct(product), iconColor: "text-emerald-400" },
    { icon: Palette, label: "Checkout Builder", action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`), iconColor: "text-muted-foreground" },
    ...(product.checkout_url
      ? [
          { icon: copied ? CheckCircle2 : Copy, label: copied ? "Link copiado!" : "Copiar link do checkout", action: () => onCopyLink(product), iconColor: copied ? "text-emerald-400" : "text-muted-foreground" },
          { icon: ExternalLink, label: "Abrir checkout", action: () => onOpenCheckout(product), iconColor: "text-muted-foreground" },
        ]
      : []),
    { icon: Crosshair, label: "Pixels & Tracking", action: () => onOpenPixels(product), iconColor: "text-muted-foreground" },
    { icon: Star, label: "Área de membros", action: () => onOpenMembers(product), iconColor: "text-muted-foreground" },
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
              ? "inline-flex h-10 min-w-[100px] items-center justify-center gap-2 rounded-xl border border-border/20 bg-secondary/30 px-3 text-[11.5px] font-semibold text-foreground/70 transition-all duration-200 hover:border-primary/25 hover:bg-primary/8 hover:text-foreground"
              : "flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-muted-foreground/40 transition-all hover:border-border/25 hover:bg-background hover:text-foreground",
            triggerClassName
          )}
        >
          <MoreHorizontal className={labeledTrigger ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.7} />
          {triggerLabel && <span>{triggerLabel}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        collisionPadding={16}
        className="w-[240px] rounded-2xl border border-border bg-card p-1.5 shadow-none"
      >
        {/* Product name header */}
        <div className="px-3 py-2">
          <p className="truncate text-[12px] font-bold tracking-tight text-sidebar-accent-foreground">{product.name}</p>
        </div>

        <DropdownMenuSeparator className="mx-1.5 my-1 bg-sidebar-border" />

        {/* Action items */}
        <div className="space-y-0.5">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.label}
              onClick={item.action}
              className="cursor-pointer gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground transition-colors focus:bg-sidebar-accent focus:text-sidebar-accent-foreground data-[highlighted]:bg-sidebar-accent data-[highlighted]:text-sidebar-accent-foreground"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
                <item.icon className={cn("h-3.5 w-3.5", item.iconColor)} strokeWidth={1.8} />
              </div>
              {item.label}
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator className="mx-1.5 my-1 bg-sidebar-border" />

        {/* Delete action */}
        <DropdownMenuItem
          onClick={() => onDeleteProduct(product)}
          className="cursor-pointer gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-destructive transition-colors focus:bg-destructive/10 data-[highlighted]:bg-destructive/10"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5 text-destructive" strokeWidth={1.8} />
          </div>
          Excluir produto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
