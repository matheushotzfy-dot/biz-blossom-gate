import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Clock, CheckCircle2 } from "lucide-react";
import { logAdminAction } from "@/lib/auditLog";
import type { Tables } from "@/integrations/supabase/types";

type Ticket = Tables<"support_tickets">;

export default function AdminSupportTab({ profiles }: { profiles: { user_id: string; full_name: string | null; email: string | null }[] }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(200);
    if (data) setTickets(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getName = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.full_name || p?.email || userId.slice(0, 8);
  };

  const handleReply = async (ticket: Ticket) => {
    if (!replyText.trim()) return;
    setSending(true);
    const { error } = await supabase.from("support_tickets").update({
      admin_reply: replyText.trim(),
      status: "answered",
      replied_at: new Date().toISOString(),
    }).eq("id", ticket.id);
    if (error) { toast.error("Erro ao responder"); setSending(false); return; }
    toast.success("Resposta enviada!");
    await logAdminAction("reply_ticket", "support_ticket", ticket.id);
    setReplyingId(null);
    setReplyText("");
    setSending(false);
    load();
  };

  const handleClose = async (id: string) => {
    await supabase.from("support_tickets").update({ status: "closed" }).eq("id", id);
    toast.success("Ticket encerrado");
    await logAdminAction("close_ticket", "support_ticket", id);
    load();
  };

  const pending = tickets.filter(t => t.status === "open" || t.status === "pending").length;

  if (loading) return <div className="flex justify-center py-20"><div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Tickets de Suporte</h2>
          <p className="text-xs text-white/40 mt-1">{tickets.length} tickets · {pending} pendentes</p>
        </div>
      </div>

      <div className="space-y-3">
        {tickets.map(ticket => (
          <div key={ticket.id} className="rounded-xl border border-white/[0.06] p-4 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={ticket.status} />
                  <span className="text-[10px] text-white/30 uppercase font-bold tracking-wider">{ticket.priority}</span>
                </div>
                <h3 className="text-sm font-bold text-white/90 truncate">{ticket.subject}</h3>
                <p className="text-xs text-white/40 mt-0.5">por {getName(ticket.user_id)} · {new Date(ticket.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {ticket.status !== "closed" && (
                  <>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={() => { setReplyingId(replyingId === ticket.id ? null : ticket.id); setReplyText(ticket.admin_reply || ""); }}>
                      <Send className="h-3 w-3" /> Responder
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] text-white/30" onClick={() => handleClose(ticket.id)}>
                      <CheckCircle2 className="h-3 w-3" /> Fechar
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="text-xs text-white/50 leading-relaxed bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
              {ticket.message}
            </div>

            {ticket.admin_reply && replyingId !== ticket.id && (
              <div className="text-xs text-emerald-400/70 leading-relaxed bg-emerald-500/[0.04] rounded-lg p-3 border border-emerald-500/[0.08]">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/40 block mb-1">Resposta Admin</span>
                {ticket.admin_reply}
              </div>
            )}

            {replyingId === ticket.id && (
              <div className="space-y-2">
                <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Digite sua resposta..." className="min-h-[80px] text-xs bg-white/[0.03] border-white/[0.08]" />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setReplyingId(null)}>Cancelar</Button>
                  <Button size="sm" className="h-7 text-[10px] gap-1" onClick={() => handleReply(ticket)} disabled={sending}>
                    <Send className="h-3 w-3" /> Enviar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {tickets.length === 0 && <p className="text-center text-white/30 text-sm py-12">Nenhum ticket de suporte</p>}
      </div>
    </div>
  );
}
