import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronLeft, Loader2, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AttachmentChips } from "@/components/support/AttachmentChips";
import { useConfirm } from "@/components/seller-ui/confirm";
import { CATEGORIES, ROLE_LABEL, dayLabel, formatClock, formatFull, linkify, splitTicketBody } from "@/components/support/supportModel";
import { dateLabel } from "@/features/admin-disputes/disputesModel";
import { Figure, ToneTag } from "@/features/admin-products/parts";
import { agoLabel } from "@/features/admin-errors/errorsModel";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { Composer } from "./Composer";
import { TICKET_KEY, callRpc, useRefreshSupport } from "./supportAdminApi";
import {
  PRIORITY_OPTIONS, STAGE_INFO, accountStatusLabel, messageLabel, parseTicketDetail, priorityInfo, salesText, sellerName, ticketRef,
  type SellerContext, type ThreadMessage, type TicketDetail,
} from "./supportAdminModel";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Body({ text, mine }: { text: string; mine: boolean }) {
  return (
    <>
      {linkify(text).map((p, i) => p.type === "link"
        ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow" className={cn("break-all underline underline-offset-2", mine ? "text-primary-foreground" : "text-primary")}>{p.text}</a>
        : <Fragment key={i}>{p.text}</Fragment>)}
    </>
  );
}

function Bubble({ m, seller }: { m: ThreadMessage; seller: string }) {
  const staff = m.sender_type === "staff";
  const label = messageLabel(m, seller, ROLE_LABEL);
  const split = staff ? null : splitTicketBody(m.body);
  const cat = split?.category ? CATEGORIES.find((c) => c.label === split.category) : undefined;
  const text = split ? split.text : m.body;
  return (
    <div className={cn("flex flex-col", staff ? "items-end" : "items-start")}>
      <p className="mb-1 max-w-full truncate px-1 text-[12.5px] text-muted-foreground" title={formatFull(m.created_at)}>
        <span className="font-semibold text-foreground">{label.who}</span>
        {staff && label.role && label.role !== label.who ? <span> · {label.role}</span> : null}
        <span> · {formatClock(m.created_at)}</span>
      </p>
      <div className={cn("max-w-[min(92%,640px)] whitespace-pre-wrap break-words rounded-[18px] px-4 py-3 text-[14px] leading-relaxed",
        staff ? "rounded-tr-[6px] bg-primary text-primary-foreground" : "rounded-tl-[6px] bg-muted text-foreground")}>
        {(cat || split?.reference) && (
          <p className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] font-semibold text-muted-foreground">
            {cat && <span>{cat.label}</span>}
            {split?.reference && <span>Referência: {split.reference}</span>}
          </p>
        )}
        <Body text={text} mine={staff} />
        {m.attachments.length > 0 && <div className="mt-2"><AttachmentChips attachments={m.attachments} mine={staff} /></div>}
      </div>
    </div>
  );
}

function Context({ u, onOpen }: { u: SellerContext; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-3 px-4 pb-4 pt-1">
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 md:grid-cols-[repeat(4,minmax(0,1fr))]">
        <Figure label="Vendas pagas" value={u.sales.toLocaleString("pt-BR")} sub={u.sales === 0 ? "nenhuma ainda" : undefined} />
        <Figure label="Total vendido" value={brl(u.gross)} />
        <Figure label="Última venda" value={u.last_sale ? agoLabel(u.last_sale) : "—"} />
        <Figure label="Na plataforma desde" value={u.joined_at ? dateLabel(u.joined_at) : "—"} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        <ToneTag tone={u.account_status === "approved" ? "success" : u.account_status === "pending" ? "warning" : "neutral"}>{accountStatusLabel(u.account_status)}</ToneTag>
        <span>{u.tickets_total === 1 ? "Este é o único chamado dele." : `${u.tickets_total.toLocaleString("pt-BR")} chamados no total.`}</span>
      </div>
      {u.previous.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-muted-foreground">Outros chamados</p>
          <ul className="divide-y divide-border/50 rounded-[12px] border border-border/60">
            {u.previous.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onOpen(p.id)} className="vp-r12 flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-muted/40">
                  <span className="min-w-0 truncate text-[13.5px] font-medium text-foreground">{p.subject}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <ToneTag tone={STAGE_INFO[p.stage].tone}>{STAGE_INFO[p.stage].label}</ToneTag>
                    <span className="text-[12px] tabular-nums text-muted-foreground">{dateLabel(p.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A conversa aberta: cabeçalho com as ações, o seller, as mensagens e a resposta. */
export function TicketThread({ id, draft, files, onDraft, onFiles, typing, onTyping, onBack, onOpen }: {
  id: string; draft: string; files: File[]; onDraft: (v: string) => void; onFiles: (f: File[]) => void;
  typing: boolean; onTyping: () => void; onBack: () => void; onOpen: (id: string) => void;
}) {
  const refresh = useRefreshSupport();
  const confirm = useConfirm();
  const [about, setAbout] = useState(false);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const marking = useRef(false);
  const q = useQuery({
    queryKey: [...TICKET_KEY, id],
    queryFn: async () => parseTicketDetail(await callRpc("get_admin_support_ticket", { _id: id })),
  });
  const d = q.data;

  // abrir a conversa é lê-la: zera o contador de mensagens novas (também as que chegam com ela aberta)
  const unread = d?.unread_by_staff ?? 0;
  useEffect(() => {
    if (unread <= 0 || marking.current) return;
    marking.current = true;
    void callRpc("admin_mark_ticket_read", { _ticket_id: id }).then(refresh, () => undefined).finally(() => { marking.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, unread]);

  useEffect(() => { setAbout(false); }, [id]);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [id, d?.messages.length, typing]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: ThreadMessage[] }[] = [];
    for (const m of d?.messages ?? []) {
      const label = dayLabel(m.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(m);
      else out.push({ key: `${label}-${m.id}`, label, items: [m] });
    }
    return out;
  }, [d?.messages]);

  const closed = d?.stage === "done";
  const who = d ? sellerName(d.user) : "";

  const run = async (name: string, args: Record<string, unknown>, ok: string, fail: string) => {
    setBusy(true);
    try { await callRpc(name, args); toast.success(ok); refresh(); }
    catch (e) { toast.error(friendlyError(e, fail)); }
    finally { setBusy(false); }
  };

  const close = async () => {
    const ok = await confirm.ask({
      title: "Encerrar este chamado?", tone: "default", icon: <CheckCircle2 className="h-5 w-5" />, confirmLabel: "Encerrar chamado",
      description: "O seller vê o chamado como encerrado. Se ele escrever de novo, o chamado reabre sozinho. As mensagens e os anexos continuam guardados.",
    });
    if (ok) await run("admin_set_ticket_status", { _ticket_id: id, _status: "closed" }, "Chamado encerrado.", "Não foi possível encerrar o chamado. Nada mudou.");
  };

  if (q.isPending) return <p className="flex flex-1 items-center justify-center gap-2 p-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo o chamado…</p>;
  if (q.isError || !d) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p role="alert" className="max-w-sm text-[14px] font-medium text-destructive">{friendlyError(q.error, "Não foi possível abrir este chamado.")}</p>
        <div className="flex gap-2">
          <button type="button" className="vp-ghost justify-center" onClick={onBack}>Voltar à lista</button>
          <button type="button" className="vp-cta justify-center" onClick={() => void q.refetch()}>Tentar de novo</button>
        </div>
      </div>
    );
  }

  return <ThreadBody {...{ d, who, closed, groups, about, setAbout, busy, scroller, typing, draft, files, onDraft, onFiles, onTyping, onBack, onOpen, close, run, id }} dialog={confirm.dialog} />;
}

function ThreadBody({ d, who, closed, groups, about, setAbout, busy, scroller, typing, draft, files, onDraft, onFiles, onTyping, onBack, onOpen, close, run, id, dialog }: {
  d: TicketDetail; who: string; closed: boolean; groups: { key: string; label: string; items: ThreadMessage[] }[]; about: boolean; setAbout: (v: boolean) => void;
  busy: boolean; scroller: RefObject<HTMLDivElement>; typing: boolean; draft: string; files: File[]; onDraft: (v: string) => void; onFiles: (f: File[]) => void;
  onTyping: () => void; onBack: () => void; onOpen: (id: string) => void; close: () => Promise<void>;
  run: (name: string, args: Record<string, unknown>, ok: string, fail: string) => Promise<void>; id: string; dialog: ReactNode;
}) {
  const refresh = useRefreshSupport();
  const stage = STAGE_INFO[d.stage];
  const prio = priorityInfo(d.priority);
  return (
    <>
      <header className="shrink-0 border-b border-border/60 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Voltar à lista" className="vp-r12 -ml-1 mt-0.5 grid h-9 w-9 shrink-0 place-items-center text-muted-foreground hover:bg-muted/50 hover:text-foreground lg:hidden">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <ToneTag tone={stage.tone}>{stage.label}</ToneTag>
              {d.priority !== "normal" && <ToneTag tone={prio.tone}>{`Prioridade ${prio.label.toLowerCase()}`}</ToneTag>}
              <span className="font-mono text-[12px] text-muted-foreground">{ticketRef(d.id)}</span>
            </div>
            <h2 className="mt-1.5 break-words text-[16px] font-bold leading-snug text-foreground">{d.subject}</h2>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{who}{d.user.email && d.user.name ? ` · ${d.user.email}` : ""} · aberto {agoLabel(d.created_at)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" aria-expanded={about} onClick={() => setAbout(!about)} className="vp-ghost !h-9 justify-center gap-1.5 !px-3 text-[13px]">
            Sobre o seller <ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", about && "rotate-180")} />
          </button>
          {d.can_reply && (
            <>
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground sm:ml-auto">
                <span className="hidden sm:inline">Prioridade</span>
                <select aria-label="Prioridade do chamado" value={d.priority} disabled={busy || closed} className="vp-r10 h-9 rounded-[10px] bg-muted/40 px-2.5 text-[13px] font-medium text-foreground disabled:opacity-60"
                  onChange={(e) => void run("admin_set_ticket_priority", { _ticket_id: id, _priority: e.target.value }, `Prioridade: ${priorityInfo(e.target.value).label.toLowerCase()}.`, "Não foi possível mudar a prioridade. Nada mudou.")}>
                  {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              {closed
                ? <button type="button" className="vp-ghost !h-9 justify-center gap-1.5 !px-3 text-[13px]" disabled={busy} onClick={() => void run("admin_set_ticket_status", { _ticket_id: id, _status: "open" }, "Chamado reaberto.", "Não foi possível reabrir o chamado. Nada mudou.")}><RotateCcw className="h-4 w-4" /> Reabrir</button>
                : <button type="button" className="vp-ghost !h-9 justify-center gap-1.5 !px-3 text-[13px]" disabled={busy} onClick={() => void close()}><CheckCircle2 className="h-4 w-4" /> Encerrar</button>}
            </>
          )}
        </div>
      </header>

      {about && <div className="shrink-0 overflow-y-auto border-b border-border/60 bg-muted/20 lg:max-h-[300px]"><Context u={d.user} onOpen={onOpen} /></div>}

      <div ref={scroller} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5" role="log" aria-label="Mensagens do chamado">
        {d.messages_total > d.messages.length && <p className="text-center text-[12.5px] text-muted-foreground">Mostrando as últimas {d.messages.length.toLocaleString("pt-BR")} de {d.messages_total.toLocaleString("pt-BR")} mensagens.</p>}
        {groups.map((g) => (
          <section key={g.key} className="space-y-3.5" aria-label={g.label}>
            <p className="text-center text-[12.5px] font-medium text-muted-foreground">{g.label}</p>
            {g.items.map((m) => <Bubble key={m.id} m={m} seller={who} />)}
          </section>
        ))}
        {typing && <p className="px-1 text-[13px] text-muted-foreground" role="status">{who} está digitando…</p>}
      </div>

      {!d.can_reply ? (
        <p className="flex shrink-0 items-start gap-2 border-t border-border/60 bg-muted/20 px-4 py-3.5 text-[13px] text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Você pode ler este chamado, mas não responder. Peça ao administrador a permissão “Responder chamados”.
        </p>
      ) : closed ? (
        <p className="shrink-0 border-t border-border/60 bg-muted/20 px-4 py-3.5 text-[13px] text-muted-foreground">Este chamado está encerrado. Reabra para responder ao seller.</p>
      ) : (
        <Composer ticketId={id} draft={draft} files={files} onDraft={onDraft} onFiles={onFiles} onTyping={onTyping} onSent={() => { onDraft(""); onFiles([]); refresh(); }} />
      )}
      {dialog}
    </>
  );
}
