import type { ReactNode } from "react";
import { VenxpayLogo } from "@/components/VenxpayLogo";

/** Estado vazio: aponta o próximo passo, nunca só avisa que não há nada. */
export function EmptyPanel({ icon, title, text, action }: { icon?: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-foreground">{icon ?? <VenxpayLogo size={34} plate={false} />}</span>
      <p className="mt-5 text-[17px] font-extrabold tracking-[-0.02em] text-foreground">{title}</p>
      <p className="mt-1 max-w-[380px] text-[14px] leading-relaxed text-muted-foreground">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
