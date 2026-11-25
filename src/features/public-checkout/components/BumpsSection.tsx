import { Check, Package } from "lucide-react";
import { formatBRL } from "../pricing";
import type { CheckoutBump } from "../types";

export function BumpsSection({ bumps, selected, onToggle }: { bumps: CheckoutBump[]; selected: Set<string>; onToggle: (id: string) => void }) {
  if (bumps.length === 0) return null;
  return (
    <section className="ck-card" aria-labelledby="ck-h-bumps">
      <div className="ck-card-head">
        <div>
          <h2 id="ck-h-bumps">Adicione ao pedido</h2>
          <p className="ck-card-sub">Opcional. Entra no mesmo pagamento.</p>
        </div>
      </div>
      <div className="ck-choices">
        {bumps.map((bump) => {
          const checked = selected.has(bump.id);
          return (
            <label key={bump.id} className="ck-choice" data-checked={checked}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(bump.id)} />
              <span className="ck-bump-thumb" aria-hidden="true">
                {bump.imageUrl ? <img src={bump.imageUrl} alt="" loading="lazy" /> : <Package size={22} />}
              </span>
              <span className="ck-choice-body">
                <span className="ck-choice-title">{bump.name}</span>
                {bump.description && <span className="ck-choice-text ck-clamp">{bump.description}</span>}
                <span className="ck-bump-price ck-num">+ {formatBRL(bump.price)}</span>
              </span>
              <span className="ck-mark" data-shape="square" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
