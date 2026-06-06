import {
  Copy,
  Crosshair,
  ExternalLink,
  MoreHorizontal,
  Palette,
  Pencil,
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

type Row = {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  action: () => void;
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
          { icon: copied ? Copy : Copy, label: copied ? "Link copiado" : "Copiar link de checkout", shortcut: "C", action: () => onCopyLink(product) },
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
      className="group/row flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[12.5px] text-foreground/85 outline-none transition-colors focus:bg-secondary focus:text-foreground data-[highlighted]:bg-secondary data-[highlighted]:text-foreground"
    >
      <row.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover/row:text-foreground group-data-[highlighted]/row:text-foreground" strokeWidth={1.75} />
      <span className="flex-1 truncate font-medium">{row.label}</span>
      {row.shortcut && (
        <kbd className="ml-2 hidden h-5 min-w-[20px] items-center justify-center rounded border border-border bg-secondary px-1 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          {row.shortcut}
        </kbd>
      )}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            labeledTrigger
              ? "inline-flex h-10 min-w-[108px] items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-[11.5px] font-semibold text-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground"
              : "flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
            triggerClassName,
          )}
        >
          <MoreHorizontal className={labeledTrigger ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.8} />
          {triggerLabel && <span>{triggerLabel}</span>}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        collisionPadding={16}
        className="w-[260px] overflow-hidden rounded-lg border border-border bg-popover p-1"
      >
        {/* Header — minimal, single line */}
        <div className="px-2 pb-1 pt-1.5">
          <p className="truncate text-[11px] font-semibold text-muted-foreground">
            {product.name || "Produto"}
          </p>
        </div>

        <DropdownMenuSeparator className="my-1 bg-border" />

        {groupManagement.map(renderRow)}

        <DropdownMenuSeparator className="my-1 bg-border" />

        {groupDistribution.map(renderRow)}

        <DropdownMenuSeparator className="my-1 bg-border" />

        <DropdownMenuItem
          onClick={() => onDeleteProduct(product)}
          className="group/del flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[12.5px] text-destructive outline-none transition-colors focus:bg-destructive/10 data-[highlighted]:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="flex-1 truncate font-medium">Excluir produto</span>
          <kbd className="ml-2 hidden h-5 min-w-[20px] items-center justify-center rounded border border-destructive/30 bg-destructive/10 px-1 font-mono text-[10px] font-medium text-destructive sm:inline-flex">
            ⌫
          </kbd>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
