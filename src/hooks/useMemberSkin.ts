import { useEffect } from "react";

/**
 * A área do aluno é sempre escura ("noir"), qualquer que seja o tema do painel do vendedor.
 * Os tokens escuros ficam em `html.vp-noir` (index.css); a classe vai no <html> para menus,
 * diálogos e toasts em portal herdarem as mesmas cores.
 */
export function useMemberSkin() {
  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("vp-noir");
    root.classList.add("vp-noir");
    return () => { if (!had) root.classList.remove("vp-noir"); };
  }, []);
}
