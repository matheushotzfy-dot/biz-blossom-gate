import { useEffect, type CSSProperties, type ReactNode } from "react";
import "../checkout.css";
import { formatClock } from "../useOfferTimer";
import { themeVars } from "../theme";
import type { CheckoutThemeMode } from "../types";

/** O app trava o scroll do documento; o checkout libera enquanto está na tela. */
function useCheckoutScroll() {
  useEffect(() => {
    document.documentElement.classList.add("ck-scroll");
    return () => document.documentElement.classList.remove("ck-scroll");
  }, []);
}

export function CheckoutShell({ mode, buttonColor, children }: { mode: CheckoutThemeMode; buttonColor?: string | null; children: ReactNode }) {
  useCheckoutScroll();
  const style: CSSProperties = themeVars(mode, buttonColor);
  return (
    <div className="ck" data-ck-theme={mode} style={style}>
      {children}
    </div>
  );
}

export function TimerBar({ secondsLeft, expired }: { secondsLeft: number; expired: boolean }) {
  return (
    <div className="ck-timer">
      <div className="ck-timer-in">
        <span id="ck-timer-label">{expired ? "O tempo da oferta acabou" : "Finalize a compra em"}</span>
        {!expired && <span className="ck-timer-clock ck-num" role="timer" aria-labelledby="ck-timer-label">{formatClock(secondsLeft)}</span>}
      </div>
    </div>
  );
}

export function Banner({ desktop, mobile }: { desktop: string | null; mobile: string | null }) {
  const wide = desktop || mobile;
  const narrow = mobile || desktop;
  if (!wide || !narrow) return null;
  return (
    <picture className="ck-banner">
      <source media="(min-width: 768px)" srcSet={wide} />
      <img src={narrow} alt="" />
    </picture>
  );
}
