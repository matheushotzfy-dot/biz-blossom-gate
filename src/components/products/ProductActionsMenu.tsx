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
  Package,
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
  hint?: string;
  action: () => void;
  variant?: "default" | "destructive";
};

type Section = {
  title: string;
  rows: Row[];
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
  const sections: Section[] = [
    {
      title: "\u200B",
      rows: [
        { icon: Pencil,         label: "Editar produto",   hint: "\u200B", action: () => onEditProduct(product) },
        { icon: Palette,        label: "Checkout builder", hint: "\u200B", action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`) },
        { icon: GraduationCap,  label: "Área de membros",  hint: "\u200B",   action: () => onOpenMembers(product) },
      ],
    },
    {
      title: "\u200B",
      rows: [
        ...(product.checkout_url
          ? [
              {
                icon: copied ? CheckCircle2 : Copy,
                label: copied ? "Link copiado" : "Copiar checkout",
                hint: copied ? "Pronto para colar" : "\u200B",
                action: () => onCopyLink(product),
              },
              { icon: ExternalLink, label: "Abrir checkout", hint: "\u200B", action: () => onOpenCheckout(product) },
            ]
          : []),
        { icon: Crosshair, label: "Pixels & tracking", hint: "\u200B", action: () => onOpenPixels(product) },
      ],
    },
  ];

  const labeledTrigger = Boolean(triggerLabel);

  const renderRow = (row: Row) => {
    const isDestructive = row.variant === "destructive";
    return (
      <DropdownMenuItem
        key={row.label}
        onClick={row.action}
        className={cn(
          "group/row relative flex h-12 cursor-pointer items-center gap-3 rounded-xl px-2.5 outline-none transition-colors duration-150",
          isDestructive
            ? "focus:bg-destructive/[0.08] data-[highlighted]:bg-destructive/[0.08]"
            : "focus:bg-muted/40 data-[highlighted]:bg-muted/40",
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
            isDestructive
              ? "border-destructive/15 bg-destructive/[0.06] text-destructive"
              : "border-border/60 bg-muted/30 text-muted-foreground group-hover/row:border-primary/30 group-hover/row:bg-primary/[0.08] group-hover/row:text-primary group-data-[highlighted]/row:border-primary/30 group-data-[highlighted]/row:bg-primary/[0.08] group-data-[highlighted]/row:text-primary",
          )}
        >
          <row.icon className="h-3.5 w-3.5" strokeWidth={2.25} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "truncate text-[12px] font-black uppercase tracking-[0.08em] leading-none",
              isDestructive ? "text-destructive" : "text-foreground",
            )}
          >
            {row.label}
          </span>
          {row.hint && (
            <span
              className={cn(
                "mt-1 truncate text-[10px] font-bold uppercase tracking-[0.14em] leading-none",
                isDestructive ? "text-destructive/60" : "text-muted-foreground/50",
              )}
            >
              {row.hint}
            </span>
          )}
        </div>
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
              ? "h-10 gap-2 px-4 text-[11px] font-black uppercase tracking-[0.18em] text-foreground/80 hover:border-primary/40 hover:bg-muted/40 active:scale-[0.98]"
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
        sideOffset={8}
        className="w-[280px] overflow-hidden rounded-2xl border border-border/60 bg-card p-0 shadow-sm"
      >
        {/* Identity Header */}
        <div className="flex items-center gap-3 border-b border-border/40 bg-muted/20 px-4 py-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-card">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground/50" strokeWidth={2} />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[13px] font-black tracking-tight text-foreground leading-none">
              {product.name || "Sem nome"}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary tabular-nums leading-none">
              {formatCurrency(Number(product.price || 0))}
            </span>
          </div>
        </div>

        {sections.map((section) => (
          <div key={section.title} className="border-b border-border/40 px-2 py-2.5 last:border-b-0">
            <div className="px-2.5 pb-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground/50">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.rows.map(renderRow)}
            </div>
          </div>
        ))}

        <div className="border-t border-border/40 bg-destructive/[0.02] px-2 py-2">
          {renderRow({
            icon: Trash2,
            label: "Excluir produto",
            hint: "Ação irreversível",
            variant: "destructive",
            action: () => onDeleteProduct(product),
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
