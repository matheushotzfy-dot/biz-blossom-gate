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
  hint?: string;
  action: () => void;
};

type Section = {
  label: string;
  items: ActionItem[];
};

const getInitial = (name: string) => (name?.trim()?.[0] || "P").toUpperCase();

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
        { icon: Pencil, label: "Editar produto", hint: "Configurações", action: () => onEditProduct(product) },
        { icon: Palette, label: "Checkout builder", hint: "Personalizar", action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`) },
        { icon: Star, label: "Área de membros", hint: "Conteúdo", action: () => onOpenMembers(product) },
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
                hint: copied ? "Pronto" : "Checkout",
                action: () => onCopyLink(product),
              },
              { icon: ExternalLink, label: "Abrir checkout", hint: "Nova aba", action: () => onOpenCheckout(product) },
            ]
          : []),
        { icon: Crosshair, label: "Pixels & tracking", hint: "Conversão", action: () => onOpenPixels(product) },
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
              : "flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground/70 transition-colors hover:border-primary/30 hover:text-foreground",
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
        className="w-[300px] overflow-hidden rounded-[20px] border border-border/40 bg-card p-0 animate-scale-in"
      >
        {/* Header — padrão Minhas Vendas: avatar + nome + meta */}
        <div className="flex items-center gap-3 border-b border-border/40 bg-muted/[0.04] px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-primary/10 font-display text-[13px] font-black text-primary">
            {getInitial(product.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[13px] font-bold tracking-tight text-foreground">
              {product.name || "Produto"}
            </p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
              Ações rápidas
            </p>
          </div>
        </div>

        {/* Sections — estilo SectionCard */}
        <div className="p-2">
          {sections.map((section, sIdx) => (
            <div key={section.label} className={cn(sIdx > 0 && "mt-2")}>
              <p className="px-2.5 pb-1.5 pt-1 text-[9.5px] font-bold uppercase tracking-[0.24em] text-muted-foreground/60">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    onClick={item.action}
                    className="group/item flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors focus:bg-muted/40 data-[highlighted]:bg-muted/40"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-muted/[0.06] transition-colors group-hover/item:border-primary/30 group-hover/item:bg-primary/[0.08] group-data-[highlighted]/item:border-primary/30 group-data-[highlighted]/item:bg-primary/[0.08]">
                      <item.icon
                        className="h-3.5 w-3.5 text-muted-foreground/80 transition-colors group-hover/item:text-primary group-data-[highlighted]/item:text-primary"
                        strokeWidth={2}
                      />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-display text-[12.5px] font-semibold tracking-tight text-foreground">
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="mt-0.5 block truncate text-[10px] font-medium tracking-wide text-muted-foreground/60">
                          {item.hint}
                        </span>
                      )}
                    </span>
                  </DropdownMenuItem>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Destructive — separado e sutil */}
        <div className="border-t border-border/40 bg-muted/[0.04] p-2">
          <DropdownMenuItem
            onClick={() => onDeleteProduct(product)}
            className="group/del flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors focus:bg-destructive/[0.08] data-[highlighted]:bg-destructive/[0.08]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/[0.06] transition-colors group-hover/del:border-destructive/40 group-hover/del:bg-destructive/[0.12]">
              <Trash2 className="h-3.5 w-3.5 text-destructive/80" strokeWidth={2} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block truncate font-display text-[12.5px] font-semibold tracking-tight text-destructive">
                Excluir produto
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-medium tracking-wide text-destructive/60">
                Ação irreversível
              </span>
            </span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
