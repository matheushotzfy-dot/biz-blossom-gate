import { useEffect, useRef } from "react";
import { firePixelEvent, initPixels, type PixelConfig } from "@/lib/pixelTracking";
import type { CheckoutProduct } from "./types";

/** Carrega os pixels do vendedor e dispara a abertura do checkout uma vez por visita. */
export function useCheckoutTracking(product: CheckoutProduct, pixels: PixelConfig[]) {
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (pixels.length === 0) return;
    initPixels(pixels);
    const params = { content_name: product.name, content_id: product.id, value: product.price };
    // O script dos pixels carrega assíncrono; esperar um instante evita perder o primeiro evento.
    const id = window.setTimeout(() => {
      if (fired.current === product.id) return;
      fired.current = product.id;
      firePixelEvent(pixels, "PageView", params);
      firePixelEvent(pixels, "ViewContent", params);
      firePixelEvent(pixels, "InitiateCheckout", { ...params, session_key: product.id });
    }, 300);
    return () => window.clearTimeout(id);
  }, [product, pixels]);
}
