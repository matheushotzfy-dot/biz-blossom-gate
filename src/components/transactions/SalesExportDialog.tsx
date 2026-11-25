import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogBody, DialogError, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";
import { EXPORT_STATUS_OPTIONS, exportStatusId } from "./exportMeta";
import type { SalesExportFilters } from "@/lib/sales-export";

export function SalesExportDialog({ open, onOpenChange, rangeLabel, products, filters, onFilters, exporting, progress, error, onCsv, onXlsx }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Período já escolhido na tela, por extenso. */
  rangeLabel: string;
  products: { id: string; name: string }[];
  filters: SalesExportFilters;
  onFilters: (next: SalesExportFilters) => void;
  exporting: boolean;
  /** Quantas vendas já foram lidas do servidor. */
  progress: number;
  error: string | null;
  onCsv: () => void;
  onXlsx: () => void;
}) {
  const set = (patch: Partial<SalesExportFilters>) => onFilters({ ...filters, ...patch });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!exporting) onOpenChange(o); }}>
      <DialogContent className={dialogBox("lg")}>
        <DialogHead icon={<Download className="h-5 w-5" />} title="Exportar vendas" subtitle={`Período: ${rangeLabel}. Filtre só se quiser menos linhas.`} />
        <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={(e) => { e.preventDefault(); onXlsx(); }}>
          <DialogBody>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="exp-search" label="Busca geral" hint="Procura em todas as colunas da planilha." className="sm:col-span-2">
                <input id="exp-search" className="vp-field" value={filters.search ?? ""} onChange={(e) => set({ search: e.target.value })} placeholder="ID, cliente, e-mail ou documento" autoComplete="off" disabled={exporting} />
              </FormField>
              <FormField id="exp-status" label="Status">
                <Select value={exportStatusId(filters.statuses)} onValueChange={(id) => set({ statuses: [...(EXPORT_STATUS_OPTIONS.find((o) => o.id === id)?.statuses ?? [])] })} disabled={exporting}>
                  <SelectTrigger id="exp-status" className="vp-r16 h-12"><SelectValue /></SelectTrigger>
                  <SelectContent collisionPadding={16}>
                    {EXPORT_STATUS_OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="exp-product" label="Produto">
                <Select value={filters.productId || "all"} onValueChange={(v) => set({ productId: v === "all" ? "" : v })} disabled={exporting}>
                  <SelectTrigger id="exp-product" className="vp-r16 h-12"><SelectValue /></SelectTrigger>
                  <SelectContent collisionPadding={16} className="max-h-72">
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="exp-name" label="Nome do cliente">
                <input id="exp-name" className="vp-field" value={filters.customerName ?? ""} onChange={(e) => set({ customerName: e.target.value })} placeholder="Nome ou parte do nome" autoComplete="off" disabled={exporting} />
              </FormField>
              <FormField id="exp-email" label="E-mail do cliente">
                <input id="exp-email" type="text" inputMode="email" className="vp-field" value={filters.customerEmail ?? ""} onChange={(e) => set({ customerEmail: e.target.value })} placeholder="cliente@email.com" autoComplete="off" disabled={exporting} />
              </FormField>
            </div>
          </DialogBody>

          {error && <DialogError>{error}</DialogError>}
          <DialogFoot
            lead={exporting ? (
              <p role="status" className="flex items-center gap-2 text-[13.5px] font-medium text-muted-foreground">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />
                {progress > 0 ? `Lendo ${progress.toLocaleString("pt-BR")} vendas…` : "Buscando as vendas…"}
              </p>
            ) : undefined}
          >
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => onOpenChange(false)} disabled={exporting}>Cancelar</button>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={onCsv} disabled={exporting}><FileText className="h-4 w-4" />Baixar CSV</button>
            <button type="submit" className="vp-cta !h-12 justify-center" disabled={exporting}><FileSpreadsheet className="h-4 w-4" />Baixar Excel</button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
