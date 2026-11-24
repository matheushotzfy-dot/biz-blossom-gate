import { useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";

/**
 * Aplica a identidade do seller (clara; escura só se o perfil escolher "escuro") no <html>.
 * O DashboardLayout já faz isso para as telas com menu lateral; este hook é para as telas
 * de tela cheia (editor de produto, construtor de checkout, área de membros), que ficam
 * fora desse layout. As classes ficam no <html> para diálogos e menus em portal herdarem os tokens.
 */
export function useSellerSkin() {
  const { theme } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("vp-seller");
    root.classList.toggle("vp-noir", theme === "dark");
    return () => root.classList.remove("vp-seller", "vp-noir");
  }, [theme]);
}
