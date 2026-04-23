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
    { icon: Settings2, label: "Editar produto", action: () => onEditProduct(product), iconColor: "text-primary" },
    { icon: Palette, label: "Abrir checkout builder", action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`), iconColor: "text-primary" },
    ...(product.checkout_url
      ? [
          { icon: copied ? CheckCircle2 : Copy, label: copied ? "Link copiado!" : "Copiar link do checkout", action: () => onCopyLink(product), iconColor: "text-primary" },
          { icon: ExternalLink, label: "Abrir checkout", action: () => onOpenCheckout(product), iconColor: "text-primary" },
        ]
      : []),
    { icon: Crosshair, label: "Pixels e tracking", action: () => onOpenPixels(product), iconColor: "text-primary" },
    { icon: Star, label: "Gerir área de membros", action: () => onOpenMembers(product), iconColor: "text-primary" },
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
          <MoreHorizontal className={labeledTrigger ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.7} />
          {triggerLabel && <span>{triggerLabel}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        collisionPadding={16}
        className="w-[252px] rounded-xl border border-border bg-card p-1.5 shadow-none"
      >
        {/* Product name header */}
        <div className="px-3 py-2.5">
          <p className="truncate font-display text-[13px] font-extrabold tracking-tight text-foreground">{product.name}</p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/55">Ações rápidas</p>
        </div>

        <DropdownMenuSeparator className="mx-1.5 my-1 bg-sidebar-border" />

        {/* Action items */}
        <div className="space-y-0.5">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.label}
              onClick={item.action}
              className="cursor-pointer gap-3 rounded-lg px-3 py-2.5 font-display text-[12.5px] font-semibold tracking-wide text-foreground/75 transition-colors focus:bg-accent focus:text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-foreground"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-secondary">
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
          className="cursor-pointer gap-3 rounded-lg px-3 py-2.5 font-display text-[12.5px] font-semibold tracking-wide text-destructive transition-colors focus:bg-destructive/10 data-[highlighted]:bg-destructive/10"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5 text-destructive" strokeWidth={1.8} />
          </div>
          Excluir produto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
