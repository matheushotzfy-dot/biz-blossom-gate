import { useEffect, useState } from "react";
import { initials } from "@/components/seller-ui/txMeta";

/** Foto do participante; se faltar ou não carregar, as iniciais. */
export function Face({ name, src, size, tone = "light", className = "" }: { name: string; src?: string | null; size: number; tone?: "light" | "dark"; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <span className={`vr-face ${className}`} data-tone={tone} style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.34)) }}>
      {src && !broken ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}
