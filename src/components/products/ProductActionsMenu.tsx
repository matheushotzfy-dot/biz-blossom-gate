import {
  Copy,
  CheckCircle2,
  Crosshair,
  ExternalLink,
  MoreHorizontal,
  Palette,
  Pencil,
  GraduationCap,
  Trash2,
  Files,
  Pause,
  Play,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { Product } from "./productPresentation";
import { formatCurrency, getEffectiveStatus, isCheckoutLive } from "./productPresentation";

export type ProductMenuHandlers = {
  onCopyLink: (product: Product) => void;
  onOpenCheckout: (product: Product) => void;
  onOpenPixels: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onOpenMembers: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onDuplicateProduct: (product: Product) => void;
  onToggleStatus: (product: Product) => void;
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
  onDuplicateProduct,
  onToggleStatus,
}: ProductActionsMenuProps) {
  const navigate = useNavigate();
  const isActive = getEffectiveStatus(product) === "active";

  const manage: Row[] = [
    { icon: Pencil, label: "Editar produto", action: () => onEditProduct(product) },
    { icon: Files, label: "Duplicar", action: () => onDuplicateProduct(product) },
    { icon: isActive ? Pause : Play, label: isActive ? "Pausar vendas" : "Reativar vendas", action: () => onToggleStatus(product) },
    { icon: Palette, label: "Checkout builder", action: () => navigate(`/vendas/produtos/${product.id}/checkout-builder`, { state: { product } }) },
    { icon: GraduationCap, label: "Área de membros", action: () => onOpenMembers(product) },
  ];

  const distribute: Row[] = [
    ...(isCheckoutLive(product)
      ? [
          { icon: copied ? CheckCircle2 : Copy, label: copied ? "Link copiado" : "Copiar checkout", action: () => onCopyLink(product) },
          { icon: ExternalLink, label: "Abrir checkout", action: () => onOpenCheckout(product) },
        ]
      : []),
    { icon: Crosshair, label: "Pixels e rastreamento", action: () => onOpenPixels(product) },
  ];

  const labeledTrigger = Boolean(triggerLabel);

  const renderRow = (row: Row) => {
    const isDestructive = row.variant === "destructive";
    return (
      <DropdownMenuItem
        key={row.label}
        onClick={row.action}
        className={cn(
          "group flex h-12 cursor-pointer items-center gap-3 rounded-[16px] px-2.5 text-[14.5px] font-semibold outline-none transition-colors",
          isDestructive
            ? "text-destructive focus:bg-destructive/10 data-[highlighted]:bg-destructive/10"
            : "text-foreground/85 focus:bg-muted data-[highlighted]:bg-muted focus:text-foreground",
        )}
      >
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors", isDestructive ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground group-data-[highlighted]:bg-primary group-data-[highlighted]:text-primary-foreground")}>
          <row.icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <span className="truncate">{row.label}</span>
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={triggerLabel ? undefined : "Mais ações do produto"}
          className={cn(
            "group relative flex items-center justify-center transition-colors",
            labeledTrigger
              ? "vp-ghost h-10 gap-2 px-4 text-[13.5px]"
              : "h-10 w-10 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            triggerClassName,
          )}
        >
          <MoreHorizontal className={labeledTrigger ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={2.25} />
          {triggerLabel && <span>{triggerLabel}</span>}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        collisionPadding={16}
        className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-72 overflow-y-auto rounded-[22px] border border-border bg-popover p-2 shadow-[0_24px_48px_-24px_hsl(222_47%_11%/.35)]"
      >
        <div className="px-3 pb-2 pt-2">
          <p className="truncate font-heading text-[16px] font-extrabold tracking-[-0.02em] text-foreground">
            {product.name || "Sem nome"}
          </p>
          <p className="text-[13px] text-muted-foreground">{formatCurrency(Number(product.price))}</p>
        </div>
        <DropdownMenuSeparator className="my-1 bg-border" />

        {manage.map(renderRow)}

        {distribute.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-1 bg-border" />
            {distribute.map(renderRow)}
          </>
        )}

        <DropdownMenuSeparator className="my-1 bg-border" />
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
