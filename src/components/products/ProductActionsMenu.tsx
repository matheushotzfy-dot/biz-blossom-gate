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
        sideOffset={6}
        collisionPadding={12}
        className="w-[220px] rounded-xl border border-border/25 bg-card p-1 shadow-[0_12px_36px_-8px_hsl(var(--foreground)/0.24)] backdrop-blur-xl"
      >
        <div className="px-2.5 py-1.5">
          <p className="truncate text-[11px] font-semibold text-foreground/80">{product.name}</p>
        </div>

        <DropdownMenuSeparator className="my-0.5 bg-border/12" />

        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onClick={item.action}
            className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium text-foreground/80 focus:bg-secondary/50 data-[highlighted]:bg-secondary/50"
          >
            <item.icon className={cn("h-3.5 w-3.5 shrink-0", item.iconColor)} strokeWidth={1.7} />
            {item.label}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="my-0.5 bg-border/12" />

        <DropdownMenuItem
          onClick={() => onDeleteProduct(product)}
          className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium text-destructive/75 focus:bg-destructive/8 data-[highlighted]:bg-destructive/8"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0 text-destructive/60" strokeWidth={1.7} />
          Excluir produto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
