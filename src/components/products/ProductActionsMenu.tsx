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
        sideOffset={6}
        className="min-w-[200px] rounded-xl border border-border/30 bg-card p-1.5 shadow-[0_12px_40px_-8px_hsl(var(--foreground)/0.15),0_4px_12px_-4px_hsl(var(--foreground)/0.08)]"
      >
        {extendedItems.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onClick={item.action}
            className="cursor-pointer gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-foreground/80 transition-colors focus:bg-primary/8 focus:text-foreground"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/60">
              <item.icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
            </div>
            {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-1.5 bg-border/20" />
        <DropdownMenuItem
          onClick={() => onDeleteProduct(product)}
          className="cursor-pointer gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-destructive/80 transition-colors focus:bg-destructive/10 focus:text-destructive"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5 text-destructive/70" strokeWidth={1.8} />
          </div>
          Excluir produto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}