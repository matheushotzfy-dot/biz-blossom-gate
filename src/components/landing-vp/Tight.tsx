import { Fragment } from "react";

/**
 * Títulos grandes em peso extra-negrito deixam um vazio visível antes de vírgula e ponto
 * (o espaço lateral do glifo). Aproxima só a pontuação, sem mexer no texto lido.
 */
export function Tight({ children }: { children: string }) {
  const parts = children.split(/([,.])/);
  return (
    <>
      {parts.map((p, i) =>
        p === "," || p === "." ? <span key={i} className="lp-p">{p}</span> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}
