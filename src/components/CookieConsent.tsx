/**
 * CookieConsent — LGPD (Lei nº 13.709/2018) + Marco Civil da Internet compliant
 *
 * Requisitos legais aplicados:
 * - Consentimento livre, informado, específico e granular (LGPD art. 5º, XII e art. 8º)
 * - Opção de recusar tão fácil quanto aceitar (ANPD Guia de Cookies, 2023)
 * - Categorias granulares (necessários, analíticos, marketing)
 * - Cookies não-essenciais bloqueados até consentimento explícito
 * - Registro do consentimento com timestamp (LGPD art. 8º §6º — comprovação)
 * - Link para Política de Privacidade
 * - Possibilidade de revogar/reconfigurar a qualquer momento
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cookie, Shield, BarChart3, Target, X, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "hotzfy-cookie-consent-v1";

export type CookiePreferences = {
  necessary: true; // sempre true (base legal: legítimo interesse / execução de contrato)
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: 1;
};

function loadConsent(): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookiePreferences;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveConsent(prefs: Omit<CookiePreferences, "timestamp" | "version" | "necessary">) {
  const value: CookiePreferences = {
    necessary: true,
    analytics: prefs.analytics,
    marketing: prefs.marketing,
    timestamp: new Date().toISOString(),
    version: 1,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("hotzfy:cookie-consent", { detail: value }));
}

export function openCookieSettings() {
  window.dispatchEvent(new Event("hotzfy:open-cookie-settings"));
}

type Category = { key: "necessary" | "analytics" | "marketing"; icon: typeof Shield; title: string; desc: string; locked?: boolean };

const CATEGORIES: Category[] = [
  {
    key: "necessary",
    icon: Shield,
    title: "Estritamente necessários",
    desc: "Essenciais para autenticação, segurança e funcionamento da plataforma. Não podem ser desativados.",
    locked: true,
  },
  {
    key: "analytics",
    icon: BarChart3,
    title: "Análise e desempenho",
    desc: "Ajudam a entender como você usa a plataforma para melhorarmos a experiência (métricas agregadas e anônimas).",
  },
  {
    key: "marketing",
    icon: Target,
    title: "Marketing e personalização",
    desc: "Usados para exibir conteúdo relevante, medir campanhas e evitar publicidade repetitiva.",
  },
];

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [managing, setManaging] = useState(false);
  const [prefs, setPrefs] = useState({ analytics: false, marketing: false });

  useEffect(() => {
    const existing = loadConsent();
    if (!existing) {
      // Delay a beat so the page can paint first (não bloqueia LCP)
      const t = window.setTimeout(() => setVisible(true), 600);
      return () => window.clearTimeout(t);
    } else {
      setPrefs({ analytics: existing.analytics, marketing: existing.marketing });
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const existing = loadConsent();
      if (existing) setPrefs({ analytics: existing.analytics, marketing: existing.marketing });
      setManaging(true);
      setVisible(true);
    };
    window.addEventListener("hotzfy:open-cookie-settings", handler);
    return () => window.removeEventListener("hotzfy:open-cookie-settings", handler);
  }, []);

  const acceptAll = () => {
    saveConsent({ analytics: true, marketing: true });
    setVisible(false);
    setManaging(false);
  };

  const rejectAll = () => {
    saveConsent({ analytics: false, marketing: false });
    setVisible(false);
    setManaging(false);
  };

  const savePartial = () => {
    saveConsent(prefs);
    setVisible(false);
    setManaging(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop apenas ao gerenciar */}
          {managing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setManaging(false)}
              className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            />
          )}

          <div
            className={cn(
              "fixed z-[100] left-0 right-0 mx-auto bottom-4 sm:bottom-6 px-3 sm:px-4 pointer-events-none",
              managing ? "max-w-2xl" : "max-w-3xl",
            )}
          >
            <motion.div
              role="dialog"
              aria-modal={managing ? "true" : "false"}
              aria-labelledby="cookie-consent-title"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="pointer-events-auto w-full"
            >
            <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/80 bg-background/95 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
              {/* subtle emerald accent */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sidebar-primary/60 to-transparent" />

              {!managing ? (
                /* ---------- Banner compacto ---------- */
                <div className="flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:gap-6">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sidebar-primary/25 bg-sidebar-primary/10 text-sidebar-primary">
                      <Cookie className="h-5 w-5" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <p id="cookie-consent-title" className="font-display text-[14px] font-bold tracking-tight text-foreground">
                        Sua privacidade importa
                      </p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                        Usamos cookies para operar a plataforma com segurança, medir desempenho e melhorar sua experiência, conforme a{" "}
                        <Link to="/politica-de-privacidade" className="font-semibold text-sidebar-primary underline-offset-2 hover:underline">
                          Política de Privacidade
                        </Link>
                        {" "}e a LGPD (Lei nº 13.709/2018). Você pode aceitar, recusar ou personalizar suas preferências.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-2 md:shrink-0">
                    <button
                      type="button"
                      onClick={() => setManaging(true)}
                      className="h-10 rounded-lg border border-sidebar-border bg-transparent px-4 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:border-sidebar-primary/40 hover:text-foreground"
                    >
                      Gerenciar
                    </button>
                    <button
                      type="button"
                      onClick={rejectAll}
                      className="h-10 rounded-lg border border-sidebar-border bg-transparent px-4 text-[12.5px] font-semibold text-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                    >
                      Recusar todos
                    </button>
                    <button
                      type="button"
                      onClick={acceptAll}
                      className="h-10 rounded-lg bg-sidebar-primary px-5 text-[12.5px] font-bold text-sidebar-primary-foreground transition-colors hover:bg-sidebar-primary/90"
                    >
                      Aceitar todos
                    </button>
                  </div>
                </div>
              ) : (
                /* ---------- Gerenciador granular ---------- */
                <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p id="cookie-consent-title" className="font-display text-[16px] font-black tracking-tight text-foreground">
                        Preferências de cookies
                      </p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground max-w-lg">
                        Controle granular sobre cada categoria. Seu consentimento é registrado com data/hora conforme exige o art. 8º da LGPD.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManaging(false)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border text-muted-foreground transition-colors hover:border-sidebar-primary/40 hover:text-foreground"
                      aria-label="Fechar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-5 space-y-2.5">
                    {CATEGORIES.map((cat) => {
                      const active = cat.locked ? true : prefs[cat.key as "analytics" | "marketing"];
                      const Icon = cat.icon;
                      return (
                        <div
                          key={cat.key}
                          className={cn(
                            "flex items-start gap-4 rounded-xl border p-4 transition-colors",
                            active
                              ? "border-sidebar-primary/30 bg-sidebar-primary/[0.04]"
                              : "border-sidebar-border bg-sidebar-accent/20",
                          )}
                        >
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                            active
                              ? "border-sidebar-primary/30 bg-sidebar-primary/10 text-sidebar-primary"
                              : "border-sidebar-border bg-background text-muted-foreground",
                          )}>
                            <Icon className="h-4 w-4" strokeWidth={2.2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-bold text-foreground">{cat.title}</p>
                              {cat.locked && (
                                <span className="rounded border border-sidebar-border bg-sidebar-accent/60 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                                  Sempre ativo
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{cat.desc}</p>
                          </div>
                          <button
                            type="button"
                            disabled={cat.locked}
                            onClick={() => setPrefs((p) => ({ ...p, [cat.key]: !p[cat.key as "analytics" | "marketing"] }))}
                            aria-pressed={active}
                            aria-label={`${cat.title}: ${active ? "ativado" : "desativado"}`}
                            className={cn(
                              "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
                              active
                                ? "border-sidebar-primary/40 bg-sidebar-primary"
                                : "border-sidebar-border bg-sidebar-accent",
                              cat.locked && "opacity-70 cursor-not-allowed",
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition-all",
                                active ? "left-[calc(100%-1.125rem)]" : "left-0.5",
                              )}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                      Você pode alterar suas escolhas a qualquer momento no rodapé do site.
                    </p>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={rejectAll}
                        className="h-10 rounded-lg border border-sidebar-border bg-transparent px-4 text-[12.5px] font-semibold text-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                      >
                        Recusar todos
                      </button>
                      <button
                        type="button"
                        onClick={savePartial}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-sidebar-primary px-5 text-[12.5px] font-bold text-sidebar-primary-foreground transition-colors hover:bg-sidebar-primary/90"
                      >
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                        Salvar preferências
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default CookieConsent;
