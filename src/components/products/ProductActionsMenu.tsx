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

const formatBRL = (value: number | string | null | undefined) => {
  const n = Number(value || 0);
  if (!n) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
};

const STATUS_META: Record<string, { label: string; tone: string }> = {
  active:   { label: "Ativo",     tone: "border-success/30 bg-success/10 text-success" },
  draft:    { label: "Rascunho",  tone: "border-warning/30 bg-warning/10 text-warning" },
  paused:   { label: "Pausado",   tone: "border-muted-foreground/30 bg-muted/30 text-muted-foreground" },
  inactive: { label: "Inativo",   tone: "border-muted-foreground/30 bg-muted/30 text-muted-foreground" },
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
  const status = STATUS_META[String((product as any).status || "active")] || STATUS_META.active;
  const image = (product as any).image_url as string | null;

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
        className="w-[340px] overflow-hidden rounded-2xl border border-border bg-card p-0"
      >
        {/* ─── Header: product card ─── */}
        <div className="relative border-b border-border bg-secondary px-4 pt-4 pb-3.5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
              {image ? (
                <img src={image} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-[16px] font-black text-primary">{getInitial(product.name)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-display text-[14px] font-black tracking-tight text-foreground">
                  {product.name || "Produto"}
                </p>
                <span className={cn("shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]", status.tone)}>
                  {status.label}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                <span className="font-numbers tabular-nums text-foreground">{formatBRL(product.price)}</span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span>Ações rápidas</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Sections ─── */}
        <div className="p-2.5">
          {sections.map((section, sIdx) => (
            <div key={section.label} className={cn(sIdx > 0 && "mt-3")}>
              <div className="flex items-center gap-2 px-1 pb-2">
                <p className="text-[9px] font-black uppercase tracking-[0.26em] text-muted-foreground">
                  {section.label}
                </p>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {section.items.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    onClick={item.action}
                    className="group/item flex h-[68px] cursor-pointer flex-col items-start justify-between rounded-xl border border-border bg-card p-2.5 transition-colors focus:border-primary/40 focus:bg-primary/[0.06] data-[highlighted]:border-primary/40 data-[highlighted]:bg-primary/[0.06]"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-secondary transition-colors group-hover/item:border-primary/30 group-hover/item:bg-primary/10 group-data-[highlighted]/item:border-primary/30 group-data-[highlighted]/item:bg-primary/10">
                      <item.icon
                        className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover/item:text-primary group-data-[highlighted]/item:text-primary"
                        strokeWidth={2}
                      />
                    </span>
                    <span className="w-full min-w-0">
                      <span className="block truncate font-display text-[11.5px] font-bold tracking-tight text-foreground">
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="mt-0.5 block truncate text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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

        {/* ─── Destructive ─── */}
        <div className="border-t border-border bg-secondary p-2.5">
          <DropdownMenuItem
            onClick={() => onDeleteProduct(product)}
            className="group/del flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 transition-colors focus:border-destructive/30 focus:bg-destructive/[0.08] data-[highlighted]:border-destructive/30 data-[highlighted]:bg-destructive/[0.08]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 transition-colors group-hover/del:border-destructive/50 group-hover/del:bg-destructive/15">
              <Trash2 className="h-3.5 w-3.5 text-destructive" strokeWidth={2} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block truncate font-display text-[12.5px] font-bold tracking-tight text-destructive">
                Excluir produto
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-destructive/70">
                Ação irreversível
              </span>
            </span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
