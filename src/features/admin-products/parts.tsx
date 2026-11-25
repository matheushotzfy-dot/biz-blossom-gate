import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { safeNavigationUrl } from "@/lib/safeUrl";
import { ToneTag } from "@/features/admin-disputes/parts";
import { CLASS_INFO, CLASS_NOTE, type Classification } from "./productsModel";

export { ToneTag };

/** Capa do produto; se a imagem falhar ou não existir, aparece o ícone. */
export function Thumb({ url, name, size = 44, className, icon: Icon = Package }: { url: string | null; name: string; size?: number; className?: string; icon?: LucideIcon }) {
  const [broken, setBroken] = useState(false);
  const safe = url ? safeNavigationUrl(url) : null;
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-muted/50", className)} style={{ width: size, height: size }}>
      {safe && !broken
        ? <img src={safe} alt={`Capa de ${name}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        : <Icon className="h-[42%] w-[42%] text-muted-foreground" aria-hidden />}
    </div>
  );
}

export const ClassTag = ({ value }: { value: Classification }) => <ToneTag tone={CLASS_INFO[value].tone}>{CLASS_INFO[value].label}</ToneTag>;

/** Escolha da classificação interna do produto (White, Gray, Black): grava na hora e fica no histórico. */
export function ClassPicker({ productId, value, onChanged }: { productId: string; value: Classification; onChanged?: () => void }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (next: Classification) => {
      const { error } = await supabase.rpc("admin_set_product_classification" as never, { _id: productId, _class: next, _note: null } as never);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast.success(`Classificado como ${CLASS_INFO[next].label}.`);
      void qc.invalidateQueries({ queryKey: ["admin-products"] });
      void qc.invalidateQueries({ queryKey: ["admin-product-detail", productId] });
      onChanged?.();
    },
    onError: (e) => toast.error(friendlyError(e, "Não foi possível mudar a classificação. Nada mudou.")),
  });
  return (
    <div>
      <div role="radiogroup" aria-label="Classificação do produto" className="inline-flex gap-1 rounded-full bg-muted/50 p-1">
        {(Object.keys(CLASS_INFO) as Classification[]).map((c) => {
          const on = value === c;
          return (
            <button key={c} type="button" role="radio" aria-checked={on} disabled={m.isPending} title={CLASS_INFO[c].hint}
              onClick={() => { if (!on) m.mutate(c); }}
              className={cn("vp-r12 h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60",
                on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {CLASS_INFO[c].label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[12.5px] text-muted-foreground">{CLASS_NOTE}</p>
    </div>
  );
}

/** Um bloco da raio-X: título e conteúdo. */
export const Block = ({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={className}>
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h3 className="text-[14px] font-bold text-foreground">{title}</h3>
      {aside && <span className="text-[12.5px] text-muted-foreground">{aside}</span>}
    </div>
    {children}
  </section>
);

/** Número em destaque com rótulo, usado nos blocos de financeiro. */
export const Figure = ({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "warning" | "destructive" }) => (
  <div className="min-w-0 rounded-[14px] bg-muted/40 px-3.5 py-3">
    <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
    <p className={cn("mt-0.5 truncate text-[16px] font-bold tabular-nums", tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground")}>{value}</p>
    {sub && <p className="truncate text-[12px] text-muted-foreground">{sub}</p>}
  </div>
);
