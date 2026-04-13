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
  sub: string;
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
    { icon: Settings2, label: "Editar produto", sub: "Dados e configurações", action: () => onEditProduct(product), iconColor: "text-primary" },
    { icon: Palette, label: "Checkout Builder", sub: "Personalizar pagamento", action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`), iconColor: "text-foreground/70" },
    ...(product.checkout_url
      ? [
          { icon: copied ? CheckCircle2 : Copy, label: copied ? "Link copiado!" : "Copiar link do checkout", sub: "URL para compartilhar", action: () => onCopyLink(product), iconColor: copied ? "text-success" : "text-foreground/70" },
          { icon: ExternalLink, label: "Abrir checkout", sub: "Ver página publicada", action: () => onOpenCheckout(product), iconColor: "text-foreground/70" },
        ]
      : []),
    { icon: Crosshair, label: "Pixels & Tracking", sub: "Facebook, Google, TikTok Ads", action: () => onOpenPixels(product), iconColor: "text-foreground/70" },
    { icon: Star, label: "Área de membros", sub: "Conteúdo e alunos", action: () => onOpenMembers(product), iconColor: "text-foreground/70" },
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
              ? "inline-flex h-10 min-w-[100px] items-center justify-center gap-2 rounded-xl border border-border/18 bg-secondary/24 px-3 text-[11.5px] font-semibold text-foreground/72 transition-all duration-200 hover:border-primary/18 hover:bg-primary/6 hover:text-foreground"
              : "flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-muted-foreground/35 transition-all hover:border-border/25 hover:bg-background hover:text-foreground",
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
        className="w-[260px] rounded-2xl border border-border/30 bg-card p-1.5 shadow-[0_16px_48px_-10px_hsl(var(--foreground)/0.28)] backdrop-blur-xl"
      >
        {/* Header compacto */}
        <div className="px-3 py-2">
          <p className="text-[10px] font-heading uppercase tracking-[0.2em] text-muted-foreground/40">Gerenciar</p>
          <p className="mt-0.5 truncate text-[13px] font-bold text-foreground/90">{product.name}</p>
        </div>

        <DropdownMenuSeparator className="my-1 bg-border/15" />

        {/* Items */}
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onClick={item.action}
            className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-secondary/50 data-[highlighted]:bg-secondary/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/60">
                <item.icon className={cn("h-4 w-4", item.iconColor)} strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold leading-tight text-foreground/90">{item.label}</p>
                <p className="mt-px truncate text-[10.5px] leading-tight text-muted-foreground/50">{item.sub}</p>
              </div>
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="my-1 bg-border/15" />

        {/* Excluir */}
        <DropdownMenuItem
          onClick={() => onDeleteProduct(product)}
          className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-destructive/8 data-[highlighted]:bg-destructive/8"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive/70" strokeWidth={1.7} />
            </div>
            <p className="text-[12.5px] font-semibold text-destructive/80">Excluir produto</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
