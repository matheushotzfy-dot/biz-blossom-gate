import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { PREVIEW_PATH, PREVIEW_READY, type PreviewUpdate } from "@/features/public-checkout/previewProtocol";
import { cn } from "@/lib/utils";

/* ─── Prévia: o checkout de verdade, num iframe com a largura do aparelho ─── */
const DEVICES = {
  desktop: { width: 1240, height: 860 },
  mobile: { width: 390, height: 800 },
} as const;

export function CheckoutLivePreview({ device, payload, host }: { device: "desktop" | "mobile"; payload: PreviewUpdate; host: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef(payload);
  latest.current = payload;
  const [scale, setScale] = useState(1);
  const size = DEVICES[device];
  const bezel = device === "mobile" ? 16 : 0;
  const bar = device === "mobile" ? 0 : 40;

  const send = useCallback(() => { frame.current?.contentWindow?.postMessage(latest.current, window.location.origin); }, []);
  useEffect(() => { send(); }, [payload, send]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if ((event.data as { type?: unknown } | null)?.type === PREVIEW_READY) send();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [send]);

  // Cabe na área da prévia sem mudar a largura da página dentro (é ela que decide o layout de celular ou computador).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const byWidth = el.clientWidth / (size.width + bezel);
      const byHeight = device === "mobile" && el.clientHeight > 0 ? Math.max(0.62, el.clientHeight / (size.height + bezel)) : 1;
      setScale(Math.max(0.3, Math.min(1, byWidth, byHeight)));
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [device, size.width, size.height, bezel]);

  const outerW = size.width + bezel;
  const outerH = size.height + bezel + bar;
  return (
    <div ref={box} className="flex h-full min-h-0 w-full justify-center">
      <div style={{ width: outerW * scale, height: outerH * scale }} className="shrink-0">
        <div
          style={{ width: outerW, height: outerH, transform: `scale(${scale})`, transformOrigin: "top left", ...(device === "mobile" ? { border: "8px solid #111827", background: "#111827" } : {}) }}
          className={cn("overflow-hidden", device === "mobile" ? "rounded-[34px] shadow-[0_30px_60px_-30px_rgba(15,23,42,.45)]" : "rounded-[18px] bg-card shadow-[0_30px_60px_-34px_rgba(15,23,42,.35)]")}
        >
          {device === "desktop" && (
            <div className="flex h-10 items-center gap-3 bg-muted/70 px-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
              <span aria-hidden className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-border" /><i className="h-2.5 w-2.5 rounded-full bg-border" /><i className="h-2.5 w-2.5 rounded-full bg-border" /></span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-background px-3 py-1 text-[12px] text-muted-foreground"><Lock className="h-3 w-3 shrink-0" /><span className="truncate">{host}</span></span>
            </div>
          )}
          <iframe
            ref={frame}
            src={PREVIEW_PATH}
            title={device === "mobile" ? "Prévia do checkout no celular" : "Prévia do checkout no computador"}
            onLoad={send}
            className={cn("block bg-white", device === "mobile" && "rounded-[26px]")}
            style={{ width: size.width, height: size.height, border: 0 }}
          />
        </div>
      </div>
    </div>
  );
}

