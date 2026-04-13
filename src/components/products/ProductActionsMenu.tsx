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

type MenuTone = "primary" | "secondary" | "success" | "accent";

type MenuItem = {
  icon: LucideIcon;
  label: string;
  description: string;
  action: () => void;
  tone?: MenuTone;
};

const MENU_TONE_STYLES: Record<MenuTone, { item: string; iconWrap: string; icon: string }> = {
  primary: {
    item: "border-primary/15 bg-primary/5 group-hover/item:border-primary/25 group-hover/item:bg-primary/8",
    iconWrap: "border-primary/15 bg-primary/10",
    icon: "text-primary",
  },
  secondary: {
    item: "border-border/18 bg-secondary/30 group-hover/item:border-border/28 group-hover/item:bg-secondary/55",
    iconWrap: "border-border/18 bg-secondary/80",
    icon: "text-muted-foreground",
  },
  success: {
    item: "border-success/15 bg-success/6 group-hover/item:border-success/25 group-hover/item:bg-success/10",
    iconWrap: "border-success/15 bg-success/10",
    icon: "text-success",
  },
  accent: {
    item: "border-border/18 bg-accent/40 group-hover/item:border-border/28 group-hover/item:bg-accent/60",
    iconWrap: "border-border/18 bg-accent/70",
    icon: "text-accent-foreground",
  },
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
  const configItems: MenuItem[] = [
    {
      icon: Settings2,
      label: "Editar produto",
      description: "Ajustar dados, preço e conteúdo",
      action: () => onEditProduct(product),
      tone: "primary",
    },
    {
      icon: Palette,
      label: "Checkout Builder",
      description: "Refinar o visual da página de pagamento",
      action: () => window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`),
      tone: "accent",
    },
  ];

  const linkItems: MenuItem[] = product.checkout_url
    ? [
        {
          icon: copied ? CheckCircle2 : Copy,
          label: copied ? "Link copiado" : "Copiar link",
          description: copied ? "Pronto para compartilhar" : "Copiar URL pública do checkout",
          action: () => onCopyLink(product),
          tone: copied ? "success" : "secondary",
        },
        {
          icon: ExternalLink,
          label: "Abrir checkout",
          description: "Ver a página de pagamento publicada",
          action: () => onOpenCheckout(product),
          tone: "secondary",
        },
      ]
    : [];

  const toolItems: MenuItem[] = [
    {
      icon: Crosshair,
      label: "Pixels & Tracking",
      description: "Gerenciar eventos e integrações de anúncios",
      action: () => onOpenPixels(product),
      tone: "secondary",
    },
    {
      icon: Star,
      label: "Área de membros",
      description: "Abrir estrutura de conteúdo e entrega",
      action: () => onOpenMembers(product),
      tone: "secondary",
    },
  ];

  const renderSection = (title: string, items: MenuItem[]) => (
    <div className="space-y-1.5">
      <p className="px-2 pt-1 text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/42">{title}</p>
      {items.map((item) => {
        const tone = MENU_TONE_STYLES[item.tone ?? "secondary"];

        return (
          <DropdownMenuItem
            key={item.label}
            onClick={item.action}
            className="group/item cursor-pointer rounded-2xl p-0 focus:bg-transparent data-[highlighted]:bg-transparent"
          >
            <div className={cn("flex w-full items-center gap-3.5 rounded-2xl border px-3.5 py-3 transition-all duration-200", tone.item)}>
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm", tone.iconWrap)}>
                <item.icon className={cn("h-4 w-4", tone.icon)} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold leading-tight text-foreground">{item.label}</p>
                <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground/62">{item.description}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-all duration-200 group-hover/item:translate-x-0.5 group-hover/item:text-muted-foreground/55" strokeWidth={1.6} />
            </div>
          </DropdownMenuItem>
        );
      })}
    </div>
  );

  const labeledTrigger = Boolean(triggerLabel);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            labeledTrigger
              ? "inline-flex h-10 min-w-[104px] items-center justify-center gap-2 rounded-xl border border-border/18 bg-secondary/24 px-3 text-[11.5px] font-semibold text-foreground/72 transition-all duration-200 hover:border-primary/18 hover:bg-primary/6 hover:text-foreground"
              : "flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-muted-foreground/35 transition-all hover:border-border/25 hover:bg-background hover:text-foreground",
            triggerClassName
          )}
        >
          <MoreHorizontal className={labeledTrigger ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.7} />
          {triggerLabel ? <span>{triggerLabel}</span> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-[320px] rounded-[24px] border border-border/40 bg-card/98 p-2.5 shadow-[0_28px_80px_-18px_hsl(var(--foreground)/0.32),0_10px_24px_-10px_hsl(var(--foreground)/0.16)] backdrop-blur-2xl"
      >
        <div className="rounded-2xl border border-border/18 bg-secondary/22 px-3.5 py-3">
          <p className="text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/42">Central de ações</p>
          <p className="mt-1 truncate text-[14px] font-semibold text-foreground">{product.name}</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground/60">Organize checkout, links, rastreamento e entrega do produto em um só lugar.</p>
        </div>

        <div className="mt-2.5 space-y-2">
          {renderSection("Configuração", configItems)}
          {linkItems.length > 0 ? renderSection("Links", linkItems) : null}
          {renderSection("Ferramentas", toolItems)}
        </div>

        <div className="mt-2.5 border-t border-border/16 pt-2">
          <DropdownMenuItem
            onClick={() => onDeleteProduct(product)}
            className="group/item cursor-pointer rounded-2xl p-0 focus:bg-transparent data-[highlighted]:bg-transparent"
          >
            <div className="flex w-full items-center gap-3.5 rounded-2xl border border-destructive/14 bg-destructive/6 px-3.5 py-3 transition-all duration-200 group-hover/item:border-destructive/24 group-hover/item:bg-destructive/10">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-destructive/14 bg-destructive/10 shadow-sm">
                <Trash2 className="h-4 w-4 text-destructive/80" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <p className="text-[13.5px] font-semibold leading-tight text-destructive/88">Excluir produto</p>
                <p className="mt-0.5 text-[11px] leading-tight text-destructive/55">Ação permanente e sem retorno</p>
              </div>
            </div>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
