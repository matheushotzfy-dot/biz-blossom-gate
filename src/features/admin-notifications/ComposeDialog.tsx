import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info, Loader2, Megaphone, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogError, DialogFoot, DialogHead, FieldHint, FieldLabel, dialogBox } from "@/components/seller-ui/form";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { Chip } from "@/features/admin-settings/Chip";
import { SellerPicker } from "@/features/admin-settings/SellerPicker";
import type { SellerHit } from "@/features/admin-referrals/referralsModel";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { AUDIENCES_KEY, callRpc, useRefreshNotifications } from "./notificationsApi";
import {
  AUDIENCES, COMPOSE_TYPES, MESSAGE_MAX, TITLE_MAX, audienceCount, checkCompose, cleanText, parseAudiences, parseSendResult, sellersText, sendConfirmText, sentText,
  type AudienceKey, type ComposeType,
} from "./notificationsModel";

const TYPE_ICON = { info: Info, announcement: Megaphone, warning: AlertTriangle, success: CheckCircle2, alert: XCircle } as const;
const TYPE_DOT = {
  info: "bg-info/15 text-info", announcement: "bg-primary/15 text-primary", warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success", alert: "bg-destructive/15 text-destructive",
} as const;

/** Como o aviso aparece no sino do painel do seller. */
function Preview({ type, title, message }: { type: ComposeType; title: string; message: string }) {
  const Icon = TYPE_ICON[type];
  const t = cleanText(title);
  const m = cleanText(message);
  return (
    <div className="flex gap-3 rounded-[14px] bg-muted/40 p-4" aria-label="Prévia do aviso">
      <span aria-hidden className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", TYPE_DOT[type])}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className={cn("break-words text-[13.5px] font-bold leading-snug", t ? "text-foreground" : "text-muted-foreground/70")}>{t || "Título do aviso"}</p>
        <p className={cn("mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed", m ? "text-muted-foreground" : "text-muted-foreground/70")}>{m || "A mensagem aparece aqui."}</p>
        <p className="mt-1.5 text-[12px] text-muted-foreground/80">agora há pouco</p>
      </div>
    </div>
  );
}

/** Novo aviso para os sellers. Para vários sellers pede a senha de novo; para um só, não. */
export function ComposeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const refresh = useRefreshNotifications();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [audience, setAudience] = useState<AudienceKey>("all");
  const [seller, setSeller] = useState<SellerHit | null>(null);
  const [type, setType] = useState<ComposeType>("info");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAudience("all"); setSeller(null); setType("info"); setTitle(""); setMessage(""); setTouched(false); setServerError(null);
  }, [open]);

  const aq = useQuery({
    queryKey: AUDIENCES_KEY,
    enabled: open,
    queryFn: async () => parseAudiences(await callRpc("get_admin_notification_audiences")),
  });
  const count = audienceCount(aq.data, audience);
  const problems = checkCompose({ audience, seller, title, message, count });
  const invalid = Object.keys(problems).length > 0;
  const typeNow = COMPOSE_TYPES.find((t) => t.value === type)!;
  const changed = cleanText(title) !== title.trim() || cleanText(message) !== message.trim();

  const send = useMutation({
    mutationFn: async () => parseSendResult(await callRpc("admin_send_notification", {
      _audience: audience, _user_id: audience === "one" ? seller?.user_id ?? null : null, _title: cleanText(title), _message: cleanText(message), _type: type,
    })),
    onSuccess: (r) => {
      toast.success(sentText(r.delivered, r.name));
      refresh();
      onClose();
    },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível enviar o aviso. Nada foi enviado.")),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (invalid) return;
    if (audience === "one") { void send.mutateAsync().catch(() => undefined); return; }
    sensitive.confirm(sendConfirmText(title, audience, count ?? 0), async () => { await send.mutateAsync().catch(() => undefined); });
  };

  const lead = audience === "one"
    ? <p className="text-[13px] text-muted-foreground">{seller ? `Vai para ${seller.name}.` : "Escolha o seller."}</p>
    : <p className="text-[13px] text-muted-foreground">{aq.isPending ? "Contando os sellers…" : count === null ? "Não foi possível contar os sellers." : `Vai chegar para ${sellersText(count)}.`}</p>;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !send.isPending) onClose(); }}>
        <DialogContent className={dialogBox("lg")}>
          <DialogHead icon={<Send className="h-5 w-5" />} title="Novo aviso" subtitle="Aparece no sino do painel do seller, com o selo de não lido." />
          <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
            <DialogBody>
              <div>
                <FieldLabel>Para quem</FieldLabel>
                <div role="group" aria-label="Para quem" className="flex flex-wrap gap-2">
                  {AUDIENCES.map((a) => {
                    const n = a.value === "one" ? null : audienceCount(aq.data, a.value);
                    return <Chip key={a.value} active={audience === a.value} onClick={() => { setAudience(a.value); setServerError(null); }}>{n === null ? a.label : `${a.label} · ${n.toLocaleString("pt-BR")}`}</Chip>;
                  })}
                </div>
                {touched && problems.audience ? <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{problems.audience}</p>
                  : <FieldHint>{AUDIENCES.find((a) => a.value === audience)!.hint} Equipe e sócios não recebem.</FieldHint>}
              </div>

              {audience === "one" && <SellerPicker id="notification-seller" value={seller} onChange={setSeller} error={touched ? problems.seller : null} />}

              <div>
                <FieldLabel>Tipo</FieldLabel>
                <div role="group" aria-label="Tipo do aviso" className="flex flex-wrap gap-2">
                  {COMPOSE_TYPES.map((t) => <Chip key={t.value} active={type === t.value} onClick={() => setType(t.value)}>{t.label}</Chip>)}
                </div>
                <FieldHint>{typeNow.hint}</FieldHint>
              </div>

              <div>
                <FieldLabel htmlFor="notification-title">Título</FieldLabel>
                <input id="notification-title" className="vp-field" autoComplete="off" maxLength={TITLE_MAX + 40} value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Manutenção programada no sábado" aria-invalid={touched && !!problems.title} aria-describedby="notification-title-msg" />
                <div id="notification-title-msg" className="mt-1.5 flex items-start justify-between gap-3">
                  {touched && problems.title ? <p role="alert" className="text-[12.5px] font-medium text-destructive">{problems.title}</p> : <span />}
                  <span className={cn("shrink-0 text-[12.5px] tabular-nums", cleanText(title).length > TITLE_MAX ? "font-semibold text-destructive" : "text-muted-foreground")}>{cleanText(title).length}/{TITLE_MAX}</span>
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="notification-message">Mensagem</FieldLabel>
                <textarea id="notification-message" className="vp-field resize-none" rows={4} maxLength={MESSAGE_MAX + 100} value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Diga o que mudou e o que o seller precisa fazer, se precisar." aria-invalid={touched && !!problems.message} aria-describedby="notification-message-msg" />
                <div id="notification-message-msg" className="mt-1.5 flex items-start justify-between gap-3">
                  {touched && problems.message ? <p role="alert" className="text-[12.5px] font-medium text-destructive">{problems.message}</p> : <span />}
                  <span className={cn("shrink-0 text-[12.5px] tabular-nums", cleanText(message).length > MESSAGE_MAX ? "font-semibold text-destructive" : "text-muted-foreground")}>{cleanText(message).length}/{MESSAGE_MAX}</span>
                </div>
                {changed && <FieldHint>Trechos entre &lt; e &gt; e a palavra “javascript:” são removidos por segurança. A prévia mostra o texto final.</FieldHint>}
              </div>

              <div>
                <FieldLabel>Prévia</FieldLabel>
                <Preview type={type} title={title} message={message} />
              </div>
            </DialogBody>
            {serverError && <DialogError>{serverError}</DialogError>}
            <DialogFoot lead={lead}>
              <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={send.isPending}>Cancelar</button>
              <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[170px]" disabled={send.isPending}>
                {send.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : "Enviar aviso"}
              </button>
            </DialogFoot>
          </form>
        </DialogContent>
      </Dialog>
      {sensitive.dialog}
    </>
  );
}
