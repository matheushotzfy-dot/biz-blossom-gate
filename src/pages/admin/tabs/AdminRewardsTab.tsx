import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, MapPin, Package, Truck, CheckCircle2, XCircle, Clock, Copy, ExternalLink, Eye } from "lucide-react";
import { logAdminAction } from "@/lib/auditLog";
import { cn } from "@/lib/utils";

type Claim = {
  id: string;
  user_id: string;
  tier_id: string;
  tier_label: string;
  tier_value: number;
  recipient_name: string;
  phone: string;
  document: string | null;
  shipping_street: string;
  shipping_number: string;
  shipping_complement: string | null;
  shipping_neighborhood: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  status: string;
  tracking_carrier: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  admin_notes: string | null;
  delivered_at: string | null;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; pill: string; icon: any }> = {
  pending:    { label: "Aguardando",    pill: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: Clock },
  preparing:  { label: "Preparando",    pill: "bg-blue-500/10 text-blue-400 border-blue-500/30",   icon: Package },
  shipped:    { label: "Postado",       pill: "bg-violet-500/10 text-violet-400 border-violet-500/30", icon: Truck },
  delivered:  { label: "Entregue",      pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  cancelled:  { label: "Cancelado",     pill: "bg-red-500/10 text-red-400 border-red-500/30",     icon: XCircle },
};

export default function AdminRewardsTab({ profiles }: { profiles: { user_id: string; full_name: string | null; email: string | null }[] }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Claim | null>(null);
  const [saving, setSaving] = useState(false);

  // form state when editing
  const [editStatus, setEditStatus] = useState("pending");
  const [editCarrier, setEditCarrier] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("reward_claims")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { toast.error("Erro ao carregar premiações"); setLoading(false); return; }
    setClaims(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDetails = (c: Claim) => {
    setSelected(c);
    setEditStatus(c.status);
    setEditCarrier(c.tracking_carrier || "");
    setEditCode(c.tracking_code || "");
    setEditUrl(c.tracking_url || "");
    setEditNotes(c.admin_notes || "");
  };

  const getName = (uid: string) => {
    const p = profiles.find(pr => pr.user_id === uid);
    return p?.full_name || p?.email || uid.slice(0, 8);
  };

  const getEmail = (uid: string) => profiles.find(pr => pr.user_id === uid)?.email || "";

  const saveClaim = async () => {
    if (!selected) return;
    setSaving(true);
    const payload: any = {
      status: editStatus,
      tracking_carrier: editCarrier.trim() || null,
      tracking_code: editCode.trim() || null,
      tracking_url: editUrl.trim() || null,
      admin_notes: editNotes.trim() || null,
    };
    if (editStatus === "delivered" && !selected.delivered_at) {
      payload.delivered_at = new Date().toISOString();
    }
    const { error } = await (supabase as any).from("reward_claims").update(payload).eq("id", selected.id);
    setSaving(false);
    if (error) { toast.error("Erro ao atualizar"); return; }
    await logAdminAction("update_reward_claim", "reward_claim", selected.id, { status: editStatus });
    toast.success("Premiação atualizada!");
    setSelected(null);
    load();
  };

  const filtered = filter === "all" ? claims : claims.filter(c => c.status === filter);
  const counts = {
    all: claims.length,
    pending: claims.filter(c => c.status === "pending").length,
    preparing: claims.filter(c => c.status === "preparing").length,
    shipped: claims.filter(c => c.status === "shipped").length,
    delivered: claims.filter(c => c.status === "delivered").length,
  };

  if (loading) return <div className="flex justify-center py-20"><div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2 text-foreground"><Trophy className="h-5 w-5 text-amber-400" /> Premiações</h2>
        <p className="text-xs text-muted-foreground mt-1">{claims.length} solicitações · {counts.pending} aguardando · {counts.shipped} em trânsito</p>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: "all",       label: "Todas" },
          { id: "pending",   label: "Aguardando" },
          { id: "preparing", label: "Preparando" },
          { id: "shipped",   label: "Postadas" },
          { id: "delivered", label: "Entregues" },
          { id: "cancelled", label: "Canceladas" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-7 px-2.5 rounded-md border text-[11px] font-bold uppercase tracking-wider transition-colors",
              filter === f.id
                ? "bg-foreground/10 border-foreground/40 text-foreground"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            {f.label} <span className="opacity-50 ml-1 tabular-nums">{(counts as any)[f.id] ?? "—"}</span>
          </button>
        ))}
      </div>

      {/* Claim list */}
      <div className="space-y-2">
        {filtered.map(c => {
          const meta = STATUS_META[c.status] || STATUS_META.pending;
          const Icon = meta.icon;
          return (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Trophy className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{c.tier_label} · {c.recipient_name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      Seller: <span className="text-foreground/70">{getName(c.user_id)}</span> · {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold border tabular-nums", meta.pill)}>
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => openDetails(c)} className="h-7 text-[10px] gap-1">
                    <Eye className="h-3 w-3" /> Detalhes
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma solicitação nesta categoria</div>
        )}
      </div>

      {/* Details / edit dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-400" /> Solicitação de Premiação</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              {/* Tier + seller */}
              <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Premiação</p>
                  <p className="text-foreground font-bold mt-1">{selected.tier_label}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Seller</p>
                  <p className="text-foreground font-bold mt-1">{getName(selected.user_id)}</p>
                  <p className="text-muted-foreground text-[11px]">{getEmail(selected.user_id)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Recebedor</p>
                  <p className="text-foreground font-bold mt-1">{selected.recipient_name}</p>
                  <p className="text-muted-foreground text-[11px]">{selected.phone}{selected.document ? ` · ${selected.document}` : ""}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Solicitada em</p>
                  <p className="text-foreground font-bold mt-1">{new Date(selected.created_at).toLocaleString("pt-BR")}</p>
                </div>
              </div>

              {/* Address */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Endereço de envio</p>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => {
                    const fullAddr = `${selected.shipping_street}, ${selected.shipping_number}${selected.shipping_complement ? ` - ${selected.shipping_complement}` : ""}, ${selected.shipping_neighborhood}, ${selected.shipping_city} - ${selected.shipping_state}, CEP ${selected.shipping_zip}`;
                    navigator.clipboard.writeText(fullAddr);
                    toast.success("Endereço copiado!");
                  }}>
                    <Copy className="h-3 w-3" /> Copiar
                  </Button>
                </div>
                <div className="text-sm text-foreground leading-relaxed">
                  {selected.shipping_street}, {selected.shipping_number}
                  {selected.shipping_complement && <> – {selected.shipping_complement}</>}<br />
                  {selected.shipping_neighborhood}, {selected.shipping_city} – {selected.shipping_state}<br />
                  CEP {selected.shipping_zip}
                </div>
              </div>

              {/* Status + tracking */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5"><Truck className="h-3 w-3" /> Status & rastreio</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Aguardando</SelectItem>
                        <SelectItem value="preparing">Preparando</SelectItem>
                        <SelectItem value="shipped">Postado</SelectItem>
                        <SelectItem value="delivered">Entregue</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transportadora</label>
                    <Input value={editCarrier} onChange={e => setEditCarrier(e.target.value)} placeholder="Correios, Jadlog, ..." className="h-9 mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Código de rastreio</label>
                    <Input value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="BR123456789BR" className="h-9 mt-1 font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">URL de rastreamento</label>
                    <Input value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="https://..." className="h-9 mt-1" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notas internas</label>
                  <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Observações para a equipe..." className="min-h-[70px] text-xs mt-1" />
                </div>
                {selected.tracking_url && (
                  <a href={selected.tracking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Abrir rastreio atual
                  </a>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={saveClaim} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
