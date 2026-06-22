import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ExternalLink, Loader2, ShieldCheck,
  User, Mail, Phone, FileDigit, MapPin, Building2, Calendar, Globe,
  Image as ImageIcon, Camera,
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

const DOC_META: Record<DocKind, { label: string; icon: typeof ImageIcon }> = {
  front:     { label: "Documento (Frente)",  icon: ImageIcon },
  back:      { label: "Documento (Verso)",   icon: ImageIcon },
  selfie:    { label: "Selfie c/ Documento", icon: Camera },
  cnpj_card: { label: "Cartão CNPJ",         icon: Building2 },
  other:     { label: "Outro arquivo",       icon: ImageIcon },
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

  useEffect(() => {
    if (!open || !profile?.user_id) { setDocs([]); setRejectMode(false); setRejectReason(""); return; }
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-xl bg-warning/10 border border-warning/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-warning" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[16px] font-black tracking-tight truncate">
                  Análise KYC · {profile.full_name || profile.email || "Sem identificação"}
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">{profile.user_id}</p>
              </div>
            </div>
            <span className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-[0.16em] border shrink-0",
              "bg-warning/10 text-warning border-warning/30"
            )}>
              {profile.account_status}
            </span>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/60">
          {/* ── Left: data ── */}
          <div className="p-6 space-y-5">
            <section>
              <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">Identidade</h4>
              <div className="space-y-2">
                <InfoRow icon={User} label="Nome completo" value={profile.full_name} />
                <InfoRow icon={User} label="Apelido" value={profile.nickname} />
                <InfoRow icon={FileDigit} label={(profile.document_type || "doc").toUpperCase()} value={profile.document_number} mono />
                <InfoRow icon={Mail} label="E-mail" value={profile.email} />
                <InfoRow icon={Phone} label="Telefone" value={profile.phone} mono />
              </div>
            </section>

            <section>
              <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">Endereço</h4>
              <div className="space-y-2">
                <InfoRow icon={MapPin} label="Logradouro" value={[p.street, p.street_number].filter(Boolean).join(", ") || null} />
                <InfoRow icon={MapPin} label="Complemento" value={p.complement} />
                <InfoRow icon={MapPin} label="Bairro" value={p.neighborhood} />
                <InfoRow icon={MapPin} label="Cidade / UF" value={[p.city, p.state].filter(Boolean).join(" · ") || null} />
                <InfoRow icon={MapPin} label="CEP" value={p.zip_code} mono />
                {addressParts.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/60 italic">Sem endereço cadastrado</p>
                )}
              </div>
            </section>

            <section>
              <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">Conta</h4>
              <div className="space-y-2">
                <InfoRow icon={Calendar} label="Cadastro" value={new Date(profile.created_at).toLocaleString("pt-BR")} />
                <InfoRow icon={Calendar} label="Último login" value={p.last_login_at ? new Date(p.last_login_at).toLocaleString("pt-BR") : null} />
                <InfoRow icon={Globe} label="Último IP" value={p.last_ip} mono />
                <InfoRow icon={FileDigit} label="Chave PIX" value={p.pix_key ? `${p.pix_key} (${p.pix_key_type})` : null} mono />
              </div>
              {p.kyc_rejection_reason && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-destructive mb-1">Recusa anterior</p>
                  <p className="text-[12px] text-foreground">{p.kyc_rejection_reason}</p>
                </div>
              )}
            </section>
          </div>

          {/* ── Right: docs ── */}
          <div className="p-6 bg-muted/10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Documentos enviados {docs.length > 0 && `(${docs.length})`}
            </h4>

            {loadingDocs ? (
              <div className="flex items-center justify-center py-14 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : docs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
                <ImageIcon className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-[12px] font-bold text-foreground">Nenhum documento enviado</p>
                <p className="text-[10px] text-muted-foreground mt-1">O usuário ainda não fez upload dos arquivos KYC.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {docs.map((d) => {
                  const meta = DOC_META[d.kind];
                  const Icon = meta.icon;
                  const isImg = /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(d.name);
                  return (
                    <a
                      key={d.name}
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/50 transition-colors"
                    >
                      <div className="aspect-square bg-muted/30 relative overflow-hidden">
                        {isImg ? (
                          <img src={d.url} alt={meta.label} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground">
                            <Icon className="h-7 w-7 mb-1.5" />
                            <span className="text-[10px] font-bold">Arquivo</span>
                          </div>
                        )}
                        <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md bg-background/95 border border-border/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="h-3 w-3" />
                        </div>
                      </div>
                      <div className="px-2.5 py-2 border-t border-border/40">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-foreground/90 truncate">{meta.label}</p>
                        <p className="text-[9px] text-muted-foreground/70 truncate font-mono">{d.name}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}

            {isCnpj && !docs.some(d => d.kind === "cnpj_card") && (
              <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
                <p className="text-[11px] text-warning font-semibold">Conta CNPJ sem cartão CNPJ enviado.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="border-t border-border/60 bg-card px-6 py-4">
          {rejectMode ? (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.16em] text-destructive">Motivo da recusa</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Descreva o motivo (será enviado ao usuário)..."
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-destructive/50"
              />
              <div className="flex gap-2 justify-end">
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
                  <XCircle className="h-3.5 w-3.5" /> Confirmar recusa
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                Verifique os documentos antes de aprovar. Recusas exigem motivo.
              </p>
              <div className="flex gap-2">
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
  );
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground/70">{label}</p>
        <p className={cn("text-[12px] text-foreground truncate", mono && "font-mono", !value && "text-muted-foreground/40 italic")}>
          {value || "Não informado"}
        </p>
      </div>
    </div>
  );
}
