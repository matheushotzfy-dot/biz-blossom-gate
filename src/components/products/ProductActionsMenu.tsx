import {
  CheckCircle2,
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
  shortcut?: string;
};

type Section = {
  label?: string;
  items: ActionItem[];
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
      label: "Gestão",
      items: [
        { icon: Pencil, label: "Editar produto", action: () => onEditProduct(product), shortcut: "E" },
        { icon: Palette, label: "Checkout builder", action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`), shortcut: "B" },
        { icon: Star, label: "Área de membros", action: () => onOpenMembers(product), shortcut: "M" },
      ],
    },
    {
      label: "Distribuição",
      items: [
        ...(product.checkout_url
          ? [
              {
                icon: copied ? CheckCircle2 : Copy,
                label: copied ? "Link copiado" : "Copiar link",
                action: () => onCopyLink(product),
                shortcut: "C",
              },
              { icon: ExternalLink, label: "Abrir checkout", action: () => onOpenCheckout(product), shortcut: "O" },
            ]
          : []),
        { icon: Crosshair, label: "Pixels & tracking", action: () => onOpenPixels(product), shortcut: "P" },
      ],
    },
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
          <MoreHorizontal className={labeledTrigger ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.8} />
          {triggerLabel && <span>{triggerLabel}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={10}
        collisionPadding={16}
        className="w-[260px] overflow-hidden rounded-xl border border-border bg-card p-0 shadow-none animate-scale-in"
      >
        {/* Refined header — minimal, mono-spaced */}
        <div className="flex items-center justify-between border-b border-border/50 px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[12px] font-black tracking-tight text-foreground">
              {product.name || "Produto"}
            </p>
          </div>
          <span className="ml-2 font-mono text-[8.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
            ⌘K
          </span>
        </div>

        {/* Sections */}
        <div className="py-1">
          {sections.map((section, sIdx) => (
            <div key={section.label} className={cn(sIdx > 0 && "mt-1 border-t border-border/40 pt-1")}>
              {section.label && (
                <p className="px-3.5 py-1.5 text-[8.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/45">
                  {section.label}
                </p>
              )}
              <div className="px-1">
                {section.items.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    onClick={item.action}
                    className="group/item relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors focus:bg-accent/50 data-[highlighted]:bg-accent/50"
                  >
                    {/* Accent line on hover */}
                    <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 scale-y-0 rounded-r-full bg-primary transition-transform group-hover/item:scale-y-100 group-data-[highlighted]/item:scale-y-100" />
                    <item.icon
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-colors group-hover/item:text-primary group-data-[highlighted]/item:text-primary"
                      strokeWidth={2}
                    />
                    <span className="flex-1 font-display text-[12px] font-bold tracking-tight text-foreground/90">
                      {item.label}
                    </span>
                    {item.shortcut && (
                      <kbd className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded border border-border/60 bg-muted/30 px-1.5 font-mono text-[9.5px] font-bold tabular-nums text-muted-foreground/70 transition-colors group-hover/item:border-primary/30 group-hover/item:text-primary">
                        {item.shortcut}
                      </kbd>
                    )}
                  </DropdownMenuItem>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Destructive zone */}
        <div className="border-t border-border/50 px-1 py-1">
          <DropdownMenuItem
            onClick={() => onDeleteProduct(product)}
            className="group/del relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors focus:bg-destructive/10 data-[highlighted]:bg-destructive/10"
          >
            <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 scale-y-0 rounded-r-full bg-destructive transition-transform group-hover/del:scale-y-100 group-data-[highlighted]/del:scale-y-100" />
            <Trash2 className="h-3.5 w-3.5 shrink-0 text-destructive/80" strokeWidth={2} />
            <span className="flex-1 font-display text-[12px] font-bold tracking-tight text-destructive">
              Excluir produto
            </span>
            <kbd className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded border border-destructive/30 bg-destructive/[0.08] px-1.5 font-mono text-[9.5px] font-bold tabular-nums text-destructive/80">
              ⌫
            </kbd>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
