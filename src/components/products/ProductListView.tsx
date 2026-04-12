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
      {/* Desktop */}
      <div className="hidden md:block">
        <Table className="min-w-[800px] table-fixed">
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
              <TableHead className="h-10 w-[40%] pl-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                Produto
              </TableHead>
              <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                Tipo
              </TableHead>
              <TableHead className="h-10 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                Preço
              </TableHead>
              <TableHead className="h-10 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                Status
              </TableHead>
              <TableHead className="h-10 w-14 pr-5" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {products.map((product) => (
              <TableRow
                key={product.id}
                onClick={() => handlers.onEditProduct(product)}
                className="group cursor-pointer border-border/40 transition-colors hover:bg-accent/30"
              >
                <TableCell className="py-3.5 pl-5 pr-4">
                  <div className="flex items-center gap-3.5">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-background">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground/25" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-foreground">{product.name}</p>
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground/55">
                        {product.description || "Sem descrição"}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="py-3.5">
                  <div className="space-y-1">
                    <span className="inline-flex rounded-md border border-border/40 bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground/75">
                      {DELIVERY_LABELS[product.delivery_type] || product.delivery_type}
                    </span>
                    <p className="text-[11px] font-mono text-muted-foreground/40">
                      {formatCompactDate(product.updated_at)}
                    </p>
                  </div>
                </TableCell>

                <TableCell className="py-3.5 text-right">
                  <p className="font-numbers text-[14px] font-semibold tabular-nums text-foreground">
                    {formatCurrency(Number(product.price))}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/45">
                    {product.affiliate_enabled ? `${product.affiliate_commission}% afiliado` : "Sem afiliação"}
                  </p>
                </TableCell>

                <TableCell className="py-3.5 text-center">
                  <div className="flex justify-center">
                    <ProductStatusIndicator status={product.status} />
                  </div>
                </TableCell>

                <TableCell className="py-3.5 pr-5">
                  <div
                    className="flex justify-end opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ProductActionsMenu
                      copied={copiedId === product.id}
                      product={product}
                      {...handlers}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className="flex cursor-pointer items-center gap-3 border-b border-border/40 px-4 py-3 transition-colors last:border-b-0 active:bg-accent/30"
          >
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-background">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-4 w-4 text-muted-foreground/25" strokeWidth={1.5} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold text-foreground">{product.name}</p>
                <span className="shrink-0 font-numbers text-[13px] font-semibold tabular-nums text-foreground">
                  {formatCurrency(Number(product.price))}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <ProductStatusIndicator status={product.status} tone="soft" />
                <span className="text-[11px] text-muted-foreground/45">
                  {DELIVERY_LABELS[product.delivery_type] || product.delivery_type}
                </span>
              </div>
            </div>

            <div onClick={(e) => e.stopPropagation()}>
              <ProductActionsMenu
                copied={copiedId === product.id}
                product={product}
                triggerClassName="h-8 w-8"
                {...handlers}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
