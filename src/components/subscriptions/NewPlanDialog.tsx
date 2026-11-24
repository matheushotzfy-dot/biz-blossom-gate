import { useState } from "react";
import { Loader2, Repeat } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlanFormValues } from "./types";

const EMPTY: PlanFormValues = { name: "", description: "", price: "", interval: "monthly", trial: "0", product: "" };

export interface NewPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Array<{ id: string; name: string }>;
  /** Devolve true quando o plano foi criado; o formulário só limpa nesse caso. */
  onCreate: (values: PlanFormValues) => Promise<boolean>;
}

export function NewPlanDialog({ open, onOpenChange, products, onCreate }: NewPlanDialogProps) {
  const [v, setV] = useState<PlanFormValues>(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<PlanFormValues>) => setV((cur) => ({ ...cur, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (await onCreate(v)) setV(EMPTY);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[480px] gap-0 overflow-hidden rounded-[28px] border border-border bg-card p-0">
        <DialogHeader className="flex-row items-center gap-4 space-y-0 border-b border-border px-6 py-5 text-left">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Repeat className="h-5 w-5" /></span>
          <div className="min-w-0"><DialogTitle className="text-[20px] font-extrabold tracking-[-0.03em]">Novo plano de assinatura</DialogTitle><DialogDescription className="mt-0.5 text-[14px]">Cobrança que se repete sozinha.</DialogDescription></div>
        </DialogHeader>
        <form onSubmit={(e) => { void submit(e); }} className="space-y-4 px-6 py-6">
          <div><Label htmlFor="plan-name">Nome do plano</Label><Input id="plan-name" value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Plano Premium" className="mt-1.5 h-11 rounded-xl" /></div>
          <div><Label htmlFor="plan-desc">Descrição (opcional)</Label><Input id="plan-desc" value={v.description} onChange={(e) => set({ description: e.target.value })} placeholder="O que o assinante recebe" className="mt-1.5 h-11 rounded-xl" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="plan-price">Preço</Label><div className="relative mt-1.5"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-muted-foreground">R$</span><Input id="plan-price" inputMode="decimal" value={v.price} onChange={(e) => set({ price: e.target.value })} placeholder="49,90" className="h-11 rounded-xl pl-11 font-bold tabular-nums" /></div></div>
            <div><Label>Cobrança</Label>
              <Select value={v.interval} onValueChange={(interval) => set({ interval })}>
                <SelectTrigger className="mt-1.5 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="daily">Todo dia</SelectItem><SelectItem value="weekly">Toda semana</SelectItem><SelectItem value="monthly">Todo mês</SelectItem><SelectItem value="yearly">Todo ano</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div><Label htmlFor="plan-trial">Dias de teste grátis</Label><Input id="plan-trial" type="number" min={0} max={365} value={v.trial} onChange={(e) => set({ trial: e.target.value })} className="mt-1.5 h-11 rounded-xl" /></div>
          {products.length > 0 && (
            <div><Label>Vincular a um produto (opcional)</Label>
              <Select value={v.product} onValueChange={(product) => set({ product })}>
                <SelectTrigger className="mt-1.5 h-11 rounded-xl"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Nenhum</SelectItem>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <button type="submit" disabled={busy} className="vp-cta !h-12 w-full">{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Criando…</> : "Criar plano"}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
