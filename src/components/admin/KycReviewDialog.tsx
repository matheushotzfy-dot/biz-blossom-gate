import { openExternal } from "@/lib/safeUrl";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ExternalLink, Loader2, ShieldCheck,
  User, Mail, Phone, FileDigit, MapPin, Building2, Calendar, Globe,
  Image as ImageIcon, Camera, X, Copy, FileText,
  type LucideIcon,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

interface Props {
  profile: Tables<"profiles"> | null;
  open: boolean;
  onClose: () => void;
  onApprove: (userId: string) => void | Promise<void>;
  onReject: (userId: string, reason: string) => void | Promise<void>;
}

type DocKind = "front" | "back" | "selfie" | "cnpj_card" | "other";

const DOC_META: Record<DocKind, { label: string; icon: typeof ImageIcon; tone: string }> = {
  front:     { label: "Documento · Frente",  icon: ImageIcon, tone: "text-info" },
  back:      { label: "Documento · Verso",   icon: ImageIcon, tone: "text-info" },
  selfie:    { label: "Selfie c/ Documento", icon: Camera,    tone: "text-primary" },
  cnpj_card: { label: "Cartão CNPJ",         icon: Building2, tone: "text-warning" },
  other:     { label: "Outro arquivo",       icon: FileText,  tone: "text-muted-foreground" },
};

const STATUS_TONE: Record<string, string> = {
  pending:  "bg-warning/12 text-warning border-warning/30",
  approved: "bg-success/12 text-success border-success/30",
  rejected: "bg-destructive/12 text-destructive border-destructive/30",
  blocked:  "bg-destructive/12 text-destructive border-destructive/30",
};

function detectKind(name: string): DocKind {
  const n = name.toLowerCase();
  if (n.includes("selfie")) return "selfie";
  if (n.includes("cnpj")) return "cnpj_card";
  if (n.includes("back") || n.includes("verso")) return "back";
  if (n.includes("front") || n.includes("frente")) return "front";
  return "other";
}

export default function KycReviewDialog({ profile, open, onClose, onApprove, onReject }: Props) {
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docs, setDocs] = useState<{ kind: DocKind; url: string; name: string }[]>([]);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !profile?.user_id) {
      setDocs([]); setRejectMode(false); setRejectReason(""); setLightbox(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDocs(true);
      try {
        const { data: files } = await supabase.storage.from("kyc-documents").list(profile.user_id);
        if (!files || files.length === 0) { if (!cancelled) setDocs([]); return; }
        const signed = await Promise.all(
          files.map(async (f) => {
            const { data } = await supabase.storage
              .from("kyc-documents")
              .createSignedUrl(`${profile.user_id}/${f.name}`, 3600);
            return data?.signedUrl ? { kind: detectKind(f.name), url: data.signedUrl, name: f.name } : null;
          })
        );
        if (!cancelled) setDocs(signed.filter((d): d is { kind: DocKind; url: string; name: string } => d !== null));
      } finally {
        if (!cancelled) setLoadingDocs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, profile?.user_id]);

  if (!profile) return null;
  const p = profile;
  const isCnpj = p.document_type === "cnpj";
  const addressParts = [p.street, p.street_number, p.neighborhood, p.city, p.state, p.zip_code].filter(Boolean);
  const statusTone = STATUS_TONE[p.account_status ?? "pending"] ?? STATUS_TONE.pending;

  const handleApprove = async () => {
    setSubmitting(true);
    try { await onApprove(profile.user_id); onClose(); }
    finally { setSubmitting(false); }
  };
  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error("Informe o motivo da recusa"); return; }
    setSubmitting(true);
    try { await onReject(profile.user_id, rejectReason.trim()); onClose(); }
    finally { setSubmitting(false); }
  };

  const copy = (v?: string | null) => {
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success("Copiado");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="max-w-5xl w-[96vw] p-0 gap-0 overflow-hidden rounded-2xl border border-border bg-card flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="relative shrink-0 border-b border-border bg-gradient-to-b from-warning/[0.08] to-transparent px-6 py-5">
            <DialogDescription className="sr-only">Análise KYC do seller</DialogDescription>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 shrink-0 rounded-xl bg-warning/15 border border-warning/35 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-warning" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-[15px] font-black tracking-tight truncate">
                    {profile.full_name || profile.email || "Sem identificação"}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10.5px] text-muted-foreground font-mono truncate max-w-[260px]">{profile.user_id}</p>
                    <button
                      type="button"
                      onClick={() => copy(profile.user_id)}
                      className="text-muted-foreground/60 hover:text-foreground transition-colors"
                      aria-label="Copiar ID"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-[0.16em] border",
                  statusTone,
                )}>
                  {profile.account_status}
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] min-h-0 flex-1 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-border">
            {/* Left: data */}
            <div className="p-6 space-y-5">
              <Section title="Identidade">
                <InfoRow icon={User}      label="Nome completo" value={profile.full_name} onCopy={copy} />
                <InfoRow icon={User}      label="Apelido"       value={profile.nickname} />
                <InfoRow icon={FileDigit} label={(profile.document_type || "doc").toUpperCase()} value={profile.document_number} mono onCopy={copy} />
                <InfoRow icon={Mail}      label="E-mail"        value={profile.email} onCopy={copy} />
                <InfoRow icon={Phone}     label="Telefone"      value={profile.phone} mono onCopy={copy} />
              </Section>

              <Section title="Endereço">
                <InfoRow icon={MapPin} label="Logradouro"  value={[p.street, p.street_number].filter(Boolean).join(", ") || null} />
                <InfoRow icon={MapPin} label="Complemento" value={p.complement} />
                <InfoRow icon={MapPin} label="Bairro"      value={p.neighborhood} />
                <InfoRow icon={MapPin} label="Cidade / UF" value={[p.city, p.state].filter(Boolean).join(" · ") || null} />
                <InfoRow icon={MapPin} label="CEP"         value={p.zip_code} mono />
                {addressParts.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/60 italic mt-1">Sem endereço cadastrado</p>
                )}
              </Section>

              <Section title="Conta">
                <InfoRow icon={Calendar}  label="Cadastro"     value={new Date(profile.created_at).toLocaleString("pt-BR")} />
                <InfoRow icon={Calendar}  label="Último login" value={p.last_login_at ? new Date(p.last_login_at).toLocaleString("pt-BR") : null} />
                <InfoRow icon={Globe}     label="Último IP"    value={p.last_ip} mono onCopy={copy} />
                <InfoRow icon={FileDigit} label="Chave PIX"    value={p.pix_key ? `${p.pix_key} (${p.pix_key_type})` : null} mono onCopy={copy} />
                {p.kyc_rejection_reason && (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-destructive mb-1">Recusa anterior</p>
                    <p className="text-[12px] text-foreground leading-relaxed">{p.kyc_rejection_reason}</p>
                  </div>
                )}
              </Section>
            </div>

            {/* Right: docs */}
            <div className="p-6 bg-muted/[0.04]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Documentos enviados
                </h4>
                {docs.length > 0 && (
                  <span className="text-[10px] font-bold text-muted-foreground/80 tabular-nums">
                    {docs.length} {docs.length === 1 ? "arquivo" : "arquivos"}
                  </span>
                )}
              </div>

              {loadingDocs ? (
                <div className="flex items-center justify-center py-14 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : docs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center">
                  <ImageIcon className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-[12px] font-bold text-foreground">Nenhum documento enviado</p>
                  <p className="text-[10.5px] text-muted-foreground mt-1">O usuário ainda não fez upload dos arquivos KYC.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {docs.map((d) => {
                    const meta = DOC_META[d.kind];
                    const Icon = meta.icon;
                    const isImg = /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(d.name);
                    return (
                      <div
                        key={d.name}
                        className="group relative block rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all duration-200 hover:-translate-y-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => isImg ? setLightbox(d.url) : openExternal(d.url)}
                          className="block w-full aspect-square bg-muted/30 relative overflow-hidden"
                          aria-label={`Abrir ${meta.label}`}
                        >
                          {isImg ? (
                            <img src={d.url} alt={meta.label} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" loading="lazy" />
                          ) : (
                            <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground">
                              <Icon className={cn("h-8 w-8 mb-1.5", meta.tone)} />
                              <span className="text-[10px] font-bold">Abrir arquivo</span>
                            </div>
                          )}
                          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-background/85 backdrop-blur px-1.5 py-0.5 border border-border text-[9px] font-black uppercase tracking-wider">
                            <Icon className={cn("h-2.5 w-2.5", meta.tone)} /> {d.kind}
                          </span>
                          <span className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md bg-background/90 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="h-3 w-3" />
                          </span>
                        </button>
                        <div className="px-2.5 py-2 border-t border-border">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-foreground/90 truncate">{meta.label}</p>
                          <p className="text-[9px] text-muted-foreground/70 truncate font-mono">{d.name}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isCnpj && !docs.some(d => d.kind === "cnpj_card") && (
                <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 flex items-start gap-2">
                  <Building2 className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                  <p className="text-[11px] text-warning font-semibold leading-snug">
                    Conta CNPJ sem cartão CNPJ enviado.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur px-6 py-4">
            {rejectMode ? (
              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-destructive">
                  Motivo da recusa
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Descreva o motivo (será enviado ao usuário)..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/30 focus:border-destructive/50 resize-none"
                />
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setRejectMode(false); setRejectReason(""); }} disabled={submitting}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleReject}
                    disabled={submitting || !rejectReason.trim()}
                    className="gap-1.5"
                  >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                    Confirmar recusa
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  Verifique os documentos antes de aprovar. Recusas exigem motivo.
                </p>
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Fechar</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejectMode(true)}
                    disabled={submitting}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Recusar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={submitting}
                    className="bg-success text-success-foreground hover:bg-success/90 gap-1.5"
                  >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Aprovar KYC
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-150"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <img
            src={lightbox}
            alt="Documento"
            className="max-h-[88vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">{title}</h4>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function InfoRow({
  icon: Icon, label, value, mono, onCopy,
}: { icon: LucideIcon; label: string; value?: string | null; mono?: boolean; onCopy?: (v?: string | null) => void }) {
  const canCopy = !!onCopy && !!value;
  return (
    <div className="group/row flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground/70">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className={cn("text-[12px] text-foreground truncate", mono && "font-mono", !value && "text-muted-foreground/40 italic")}>
            {value || "Não informado"}
          </p>
          {canCopy && (
            <button
              type="button"
              onClick={() => onCopy?.(value)}
              className="opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground/60 hover:text-foreground"
              aria-label={`Copiar ${label}`}
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
