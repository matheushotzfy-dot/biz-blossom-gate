import {
  CheckCircle2,
  ChevronRight,
  Copy,
  Crosshair,
  ExternalLink,
  MoreHorizontal,
  Palette,
  Settings2,
  Star,
  Trash2,
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
};

type MenuItem = {
  icon: React.ElementType;
  label: string;
  desc: string;
  action: () => void;
  accent?: string;
  iconAccent?: string;
};

export function ProductActionsMenu({
  copied,
  product,
  triggerClassName,
  onCopyLink,
  onDeleteProduct,
  onEditProduct,
  onOpenCheckout,
  onOpenMembers,
  onOpenPixels,
}: ProductActionsMenuProps) {
  const mainItems: MenuItem[] = [
    {
      icon: Settings2,
      label: "Editar produto",
      desc: "Alterar dados e configurações",
      action: () => onEditProduct(product),
      accent: "bg-primary/12 border-primary/20",
      iconAccent: "text-primary",
    },
    {
      icon: Palette,
      label: "Checkout Builder",
      desc: "Personalizar página de pagamento",
      action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`),
      accent: "bg-accent/60 border-accent-foreground/10",
      iconAccent: "text-accent-foreground",
    },
  ];

  const linkItems: MenuItem[] = product.checkout_url
    ? [
        {
          icon: copied ? CheckCircle2 : Copy,
          label: copied ? "Link copiado!" : "Copiar link do checkout",
          desc: copied ? "Pronto para colar" : "Copiar URL para compartilhar",
          action: () => onCopyLink(product),
          accent: copied ? "bg-success/12 border-success/20" : "bg-secondary/80 border-border/30",
          iconAccent: copied ? "text-success" : "text-muted-foreground",
        },
        {
          icon: ExternalLink,
          label: "Abrir checkout",
          desc: "Ver página de pagamento ao vivo",
          action: () => onOpenCheckout(product),
          accent: "bg-secondary/80 border-border/30",
          iconAccent: "text-muted-foreground",
        },
      ]
    : [];

  const toolItems: MenuItem[] = [
    {
      icon: Crosshair,
      label: "Pixels & Tracking",
      desc: "Facebook, Google, TikTok Ads",
      action: () => onOpenPixels(product),
      accent: "bg-secondary/80 border-border/30",
      iconAccent: "text-muted-foreground",
    },
    {
      icon: Star,
      label: "Área de membros",
      desc: "Conteúdo e alunos",
      action: () => onOpenMembers(product),
      accent: "bg-amber-500/10 border-amber-500/15",
      iconAccent: "text-amber-500",
    },
  ];

  const allItems = [...mainItems, ...linkItems, ...toolItems];

  const renderItem = (item: MenuItem) => (
    <DropdownMenuItem
      key={item.label}
      onClick={item.action}
      className="group/item cursor-pointer gap-0 rounded-xl p-0 transition-all duration-200 focus:bg-transparent hover:bg-transparent"
    >
      <div className="flex w-full items-center gap-3.5 rounded-xl px-3 py-3 transition-all duration-200 group-hover/item:bg-secondary/60">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-transform duration-200 group-hover/item:scale-105",
            item.accent
          )}
        >
          <item.icon className={cn("h-4 w-4", item.iconAccent)} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold leading-tight text-foreground">{item.label}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground/60 truncate">{item.desc}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-all duration-200 group-hover/item:text-muted-foreground/60 group-hover/item:translate-x-0.5" strokeWidth={1.5} />
      </div>
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-muted-foreground/35 transition-all hover:border-border/25 hover:bg-background hover:text-foreground",
            triggerClassName
          )}
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.6} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[280px] rounded-2xl border border-border/40 bg-card/98 backdrop-blur-2xl p-1.5 shadow-[0_24px_80px_-16px_hsl(var(--foreground)/0.3),0_8px_24px_-8px_hsl(var(--foreground)/0.15)]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-3 pt-2.5 pb-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[11px] font-heading uppercase tracking-[0.18em] text-muted-foreground/50">Gerenciar</p>
            <p className="text-[12.5px] font-semibold text-foreground/80 truncate max-w-[180px]">{product.name}</p>
          </div>
        </div>

        <DropdownMenuSeparator className="my-1.5 bg-border/20" />

        {/* Main actions */}
        {mainItems.map(renderItem)}

        {linkItems.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-1 bg-border/15" />
            {linkItems.map(renderItem)}
          </>
        )}

        <DropdownMenuSeparator className="my-1 bg-border/15" />
        {toolItems.map(renderItem)}

        {/* Delete */}
        <DropdownMenuSeparator className="my-1.5 bg-border/20" />
        <DropdownMenuItem
          onClick={() => onDeleteProduct(product)}
          className="group/del cursor-pointer gap-0 rounded-xl p-0 transition-all duration-200 focus:bg-transparent hover:bg-transparent"
        >
          <div className="flex w-full items-center gap-3.5 rounded-xl px-3 py-3 transition-all duration-200 group-hover/del:bg-destructive/8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 border border-destructive/15 shadow-sm transition-transform duration-200 group-hover/del:scale-105">
              <Trash2 className="h-4 w-4 text-destructive/80" strokeWidth={1.8} />
            </div>
            <div className="flex-1">
              <p className="text-[13.5px] font-semibold leading-tight text-destructive/90">Excluir produto</p>
              <p className="mt-0.5 text-[11px] leading-tight text-destructive/50">Ação irreversível</p>
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
