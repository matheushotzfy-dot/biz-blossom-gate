import { useCallback, useSyncExternalStore } from "react";

const KEY = "privacy_mode";
const EVENT = "vp:privacy-mode";

const read = () => { try { return localStorage.getItem(KEY) === "true"; } catch { return false; } };
const subscribe = (notify: () => void) => {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(EVENT, notify); window.removeEventListener("storage", notify); };
};

/**
 * "Ocultar valores": uma preferência só, lida por todas as telas ao mesmo tempo
 * (topbar, Início, Vendas). Alternar em qualquer lugar atualiza os outros na hora.
 */
export function usePrivacyMode() {
  const hidden = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => {
    try { localStorage.setItem(KEY, String(!read())); } catch { /* modo privado do navegador */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { hidden, toggle };
}
