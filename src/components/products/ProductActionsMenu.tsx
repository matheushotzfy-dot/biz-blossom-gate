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
};

export function ProductActionsMenu({
  copied,
  product,
  triggerClassName,
  onCopyLink,
  onDeleteProduct,
  onEditProduct,
  onOpenCheckout,
  onOpenMembers,
  onOpenPixels,
}: ProductActionsMenuProps) {
  const items = [
    { icon: Settings2, label: "Editar produto", action: () => onEditProduct(product) },
    { icon: Palette, label: "Checkout Builder", action: () => onEditProduct({ ...product, id: product.id }) },
  ];

  const extendedItems = [
    ...items.slice(0, 1),
    { icon: Palette, label: "Checkout Builder", action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`) },
    ...(product.checkout_url
      ? [
          {
            icon: copied ? CheckCircle2 : Copy,
            label: copied ? "Copiado!" : "Copiar link",
            action: () => onCopyLink(product),
          },
          {
            icon: ExternalLink,
            label: "Ver checkout",
            action: () => onOpenCheckout(product),
          },
        ]
      : []),
    { icon: Crosshair, label: "Pixels & Tracking", action: () => onOpenPixels(product) },
    { icon: Star, label: "Área de membros", action: () => onOpenMembers(product) },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-muted-foreground/35 transition-all hover:border-border/25 hover:bg-background hover:text-foreground",
            triggerClassName
          )}
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.6} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[240px] rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl p-2 shadow-[0_20px_60px_-12px_hsl(var(--foreground)/0.25),0_8px_20px_-6px_hsl(var(--foreground)/0.12)]"
      >
        <div className="px-3 py-2 mb-1">
          <p className="text-[10px] font-heading uppercase tracking-[0.2em] text-muted-foreground/50">Ações do produto</p>
        </div>
        {extendedItems.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onClick={item.action}
            className="cursor-pointer gap-3.5 rounded-xl px-3 py-3 text-[13.5px] font-semibold text-foreground/90 transition-all duration-200 focus:bg-primary/10 focus:text-foreground hover:translate-x-0.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary/80 border border-border/30 shadow-sm">
              <item.icon className="h-4 w-4 text-foreground/60" strokeWidth={1.8} />
            </div>
            {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-2 bg-border/25" />
        <DropdownMenuItem
          onClick={() => onDeleteProduct(product)}
          className="cursor-pointer gap-3.5 rounded-xl px-3 py-3 text-[13.5px] font-semibold text-destructive/90 transition-all duration-200 focus:bg-destructive/10 focus:text-destructive hover:translate-x-0.5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/12 border border-destructive/15 shadow-sm">
            <Trash2 className="h-4 w-4 text-destructive/80" strokeWidth={1.8} />
          </div>
          Excluir produto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}