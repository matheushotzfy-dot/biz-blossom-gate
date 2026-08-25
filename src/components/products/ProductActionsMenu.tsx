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
  const isActive = product.status === "active";

  const manage: Row[] = [
    { icon: Pencil, label: "Editar produto", action: () => onEditProduct(product) },
    { icon: Files, label: "Duplicar", action: () => onDuplicateProduct(product) },
    { icon: isActive ? Pause : Play, label: isActive ? "Pausar vendas" : "Reativar vendas", action: () => onToggleStatus(product) },
    { icon: Palette, label: "Checkout builder", action: () => navigate(`/vendas/produtos/${product.id}/checkout-builder`, { state: { product } }) },
    { icon: GraduationCap, label: "Área de membros", action: () => onOpenMembers(product) },
  ];

  const distribute: Row[] = [
    ...(product.checkout_url
      ? [
          { icon: copied ? CheckCircle2 : Copy, label: copied ? "Link copiado" : "Copiar checkout", action: () => onCopyLink(product) },
          { icon: ExternalLink, label: "Abrir checkout", action: () => onOpenCheckout(product) },
        ]
      : []),
    { icon: Crosshair, label: "Pixels & tracking", action: () => onOpenPixels(product) },
  ];

  const labeledTrigger = Boolean(triggerLabel);

  const renderRow = (row: Row) => {
    const isDestructive = row.variant === "destructive";
    return (
      <DropdownMenuItem
        key={row.label}
        onClick={row.action}
        className={cn(
          "group flex h-9 cursor-pointer items-center gap-3 rounded-md px-2.5 text-[13px] font-medium outline-none transition-colors",
          isDestructive
            ? "text-destructive focus:bg-destructive/10 data-[highlighted]:bg-destructive/10"
            : "text-foreground/85 focus:bg-muted data-[highlighted]:bg-muted focus:text-foreground",
        )}
      >
        <row.icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isDestructive ? "text-destructive/80" : "text-muted-foreground group-data-[highlighted]:text-foreground",
          )}
          strokeWidth={2}
        />
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
          className={cn(
            "group relative flex items-center justify-center rounded-xl border border-border/60 bg-card transition-all duration-200",
            labeledTrigger
              ? "h-10 gap-2 px-4 text-[11px] font-semibold text-foreground/80 hover:border-primary/40 hover:bg-muted/40 active:scale-[0.98]"
              : "h-10 w-10 text-muted-foreground hover:border-primary/40 hover:bg-muted/40 hover:text-foreground active:scale-95",
            triggerClassName,
          )}
        >
          <MoreHorizontal className={labeledTrigger ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.25} />
          {triggerLabel && <span>{triggerLabel}</span>}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        className="w-56 rounded-xl border border-border/70 bg-popover p-1.5 shadow-lg"
      >
        <div className="px-2 pb-1.5 pt-1">
          <p className="truncate text-[12px] font-semibold text-foreground/90">
            {product.name || "Sem nome"}
          </p>
        </div>
        <DropdownMenuSeparator className="my-1 bg-border/60" />

        {manage.map(renderRow)}

        {distribute.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-1 bg-border/60" />
            {distribute.map(renderRow)}
          </>
        )}

        <DropdownMenuSeparator className="my-1 bg-border/60" />
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
