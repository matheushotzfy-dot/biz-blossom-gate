import { Package } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCompactDate, formatCurrency, type Product } from "./productPresentation";

type ProductListViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

export function ProductListView({ products, copiedId, ...handlers }: ProductListViewProps) {
  return (
    <>
      <div className="hidden md:block">
        <Table className="min-w-[940px] table-fixed">
          <TableHeader>
            <TableRow className="border-border/20 hover:bg-transparent">
              <TableHead className="h-11 w-[44%] pl-5 text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/35">
                Produto
              </TableHead>
              <TableHead className="h-11 text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/35">
                Operação
              </TableHead>
              <TableHead className="h-11 text-right text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/35">
                Preço
              </TableHead>
              <TableHead className="h-11 text-center text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/35">
                Status
              </TableHead>
              <TableHead className="h-11 w-[72px] pr-5" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {products.map((product) => (
              <TableRow
                key={product.id}
                onClick={() => handlers.onEditProduct(product)}
                className="group cursor-pointer border-border/20 hover:bg-background/45 data-[state=selected]:bg-transparent"
              >
                <TableCell className="py-3 pl-5 pr-4 align-middle">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-border/25 bg-background/70">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-4.5 w-4.5 text-muted-foreground/20" strokeWidth={1.5} />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/[0.04]" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h3 className="truncate text-sm font-medium text-foreground">{product.name}</h3>
                        <span className="hidden rounded-full border border-border/25 bg-card/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/70 xl:inline-flex">
                          {DELIVERY_LABELS[product.delivery_type] || product.delivery_type}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{product.description || "Sem descrição"}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono text-muted-foreground/50">
                        <span>{DELIVERY_LABELS[product.delivery_type] || product.delivery_type}</span>
                        <span className="h-1 w-1 rounded-full bg-border/80" />
                        <span>Atualizado {formatCompactDate(product.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="px-4 py-3 align-middle">
                  <div className="space-y-1">
                    <p className={cn("text-[11px] font-medium", product.checkout_url ? "text-foreground" : "text-muted-foreground/65")}>
                      {product.checkout_url ? "Checkout ativo" : "Sem checkout publicado"}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground/45">
                      {product.affiliate_enabled ? `${product.affiliate_commission}% afiliado` : "Programa de afiliados fechado"}
                    </p>
                  </div>
                </TableCell>

                <TableCell className="px-4 py-3 text-right align-middle">
                  <p className="font-numbers text-[14px] text-foreground">{formatCurrency(Number(product.price))}</p>
                  <p className="mt-1 text-[10px] font-mono text-muted-foreground/45">Leitura financeira alinhada</p>
                </TableCell>

                <TableCell className="px-4 py-3 text-center align-middle">
                  <div className="flex justify-center">
                    <ProductStatusIndicator status={product.status} />
                  </div>
                </TableCell>

                <TableCell className="py-3 pl-0 pr-5 align-middle">
                  <div className="flex justify-end opacity-0 transition-opacity duration-200 group-hover:opacity-100" onClick={(event) => event.stopPropagation()}>
                    <ProductActionsMenu
                      copied={copiedId === product.id}
                      product={product}
                      triggerClassName="h-8 w-8 rounded-xl text-muted-foreground/35 hover:bg-background hover:text-foreground"
                      {...handlers}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden">
        {products.map((product) => (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className="group cursor-pointer border-b border-border/20 px-4 py-3 last:border-b-0"
          >
            <div className="flex items-start gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-border/25 bg-background/70">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-4.5 w-4.5 text-muted-foreground/20" strokeWidth={1.5} />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/[0.04]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium text-foreground">{product.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{product.description || "Sem descrição"}</p>
                  </div>

                  <div onClick={(event) => event.stopPropagation()}>
                    <ProductActionsMenu
                      copied={copiedId === product.id}
                      product={product}
                      triggerClassName="h-8 w-8 rounded-xl border border-border/25 bg-background/75 text-muted-foreground/60"
                      {...handlers}
                    />
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted-foreground/50">
                  <span className="rounded-full border border-border/25 bg-card/60 px-2 py-0.5 font-medium text-muted-foreground/70">
                    {DELIVERY_LABELS[product.delivery_type] || product.delivery_type}
                  </span>
                  <span>Atualizado {formatCompactDate(product.updated_at)}</span>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="font-numbers text-[14px] text-foreground">{formatCurrency(Number(product.price))}</p>
                    <p className="mt-1 text-[10px] font-mono text-muted-foreground/45">
                      {product.checkout_url ? "Checkout ativo" : "Sem checkout publicado"}
                    </p>
                  </div>

                  <div className="text-right">
                    <ProductStatusIndicator status={product.status} tone="soft" />
                    <p className="mt-1 text-[10px] font-mono text-muted-foreground/45">
                      {product.affiliate_enabled ? `${product.affiliate_commission}% afiliado` : "Sem afiliação"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}