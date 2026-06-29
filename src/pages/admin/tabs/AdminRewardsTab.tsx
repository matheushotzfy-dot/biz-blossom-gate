import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Trophy, MapPin, Package, Truck, CheckCircle2, XCircle, Clock, Copy, ExternalLink,
  Eye, Search, Map as MapIcon, Phone, Hash,
} from "lucide-react";
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
  pending:    { label: "Aguardando",    pill: "bg-amber-500/10 text-amber-400 border-amber-500/30",     icon: Clock },
  preparing:  { label: "Preparando",    pill: "bg-blue-500/10 text-blue-400 border-blue-500/30",       icon: Package },
  shipped:    { label: "Postado",       pill: "bg-violet-500/10 text-violet-400 border-violet-500/30", icon: Truck },
  delivered:  { label: "Entregue",      pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  cancelled:  { label: "Cancelado",     pill: "bg-red-500/10 text-red-400 border-red-500/30",          icon: XCircle },
};

const NEXT_STATUS: Record<string, { label: string; next: string }[]> = {
  pending:   [{ label: "Preparar", next: "preparing" }],
  preparing: [{ label: "Marcar postado", next: "shipped" }],
  shipped:   [{ label: "Marcar entregue", next: "delivered" }],
  delivered: [],
  cancelled: [],
};

const fmtZip = (z: string) => (z || "").replace(/\D/g, "").replace(/^(\d{5})(\d{3}).*/, "$1-$2");
const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminRewardsTab({ profiles }: { profiles: { user_id: string; full_name: string | null; email: string | null }[] }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Claim | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<Claim | null>(null);

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

  const updateStatus = async (c: Claim, status: string, extra: any = {}) => {
    const payload: any = { status, ...extra };
    if (status === "delivered" && !c.delivered_at) payload.delivered_at = new Date().toISOString();
    const { error } = await (supabase as any).from("reward_claims").update(payload).eq("id", c.id);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    await logAdminAction("update_reward_claim_status", "reward_claim", c.id, { status });
    toast.success(`Status atualizado: ${STATUS_META[status]?.label || status}`);
    load();
  };

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
    if (editStatus !== "delivered" && selected.delivered_at) {
      payload.delivered_at = null;
    }
    const { error } = await (supabase as any).from("reward_claims").update(payload).eq("id", selected.id);
    setSaving(false);
    if (error) { toast.error("Erro ao atualizar"); return; }
    await logAdminAction("update_reward_claim", "reward_claim", selected.id, { status: editStatus });
    toast.success("Premiação atualizada!");
    setSelected(null);
    load();
  };

  const counts = useMemo(() => ({
    all: claims.length,
    pending: claims.filter(c => c.status === "pending").length,
    preparing: claims.filter(c => c.status === "preparing").length,
    shipped: claims.filter(c => c.status === "shipped").length,
    delivered: claims.filter(c => c.status === "delivered").length,
    cancelled: claims.filter(c => c.status === "cancelled").length,
  }), [claims]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? claims : claims.filter(c => c.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.recipient_name.toLowerCase().includes(q) ||
        c.tier_label.toLowerCase().includes(q) ||
        c.shipping_city.toLowerCase().includes(q) ||
        c.shipping_state.toLowerCase().includes(q) ||
        (c.tracking_code || "").toLowerCase().includes(q) ||
        getName(c.user_id).toLowerCase().includes(q) ||
        getEmail(c.user_id).toLowerCase().includes(q)
      );
    }
    return list;
  }, [claims, filter, search, profiles]);

  const copy = (v: string, label = "Copiado") => {
    navigator.clipboard.writeText(v);
    toast.success(label);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-foreground"><Trophy className="h-5 w-5 text-amber-400" /> Premiações</h2>
          <p className="text-xs text-muted-foreground mt-1">{claims.length} solicitações · {counts.pending} aguardando · {counts.preparing} preparando · {counts.shipped} em trânsito · {counts.delivered} entregues</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nome, cidade, rastreio, seller..."
            className="h-8 pl-8 w-72 text-xs"
          />
        </div>
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
          const nexts = NEXT_STATUS[c.status] || [];
          return (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Trophy className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-bold text-foreground truncate">
                      {c.tier_label}
                      {c.tier_value > 0 && <span className="text-muted-foreground font-normal text-[11px] ml-1.5">· {fmtMoney(Number(c.tier_value))}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      <span className="text-foreground/80 font-semibold">{c.recipient_name}</span>
                      {" · "}Seller: <span className="text-foreground/70">{getName(c.user_id)}</span>
                      {" · "}{new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {c.shipping_city}/{c.shipping_state} · CEP {fmtZip(c.shipping_zip)}
                      {c.tracking_code && (
                        <span className="inline-flex items-center gap-1 ml-2 text-foreground/70">
                          <Hash className="h-3 w-3" /><span className="font-mono">{c.tracking_code}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold border tabular-nums", meta.pill)}>
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </span>
                  {nexts.map(n => (
                    <Button key={n.next} size="sm" variant="outline" onClick={() => updateStatus(c, n.next)} className="h-7 text-[10px]">
                      {n.label}
                    </Button>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => openDetails(c)} className="h-7 text-[10px] gap-1">
                    <Eye className="h-3 w-3" /> Detalhes
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma solicitação encontrada</div>
        )}
      </div>

      {/* Details / edit dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-400" /> Solicitação de Premiação</DialogTitle>
          </DialogHeader>
          {selected && (() => {
            const fullAddr = `${selected.shipping_street}, ${selected.shipping_number}${selected.shipping_complement ? ` - ${selected.shipping_complement}` : ""}, ${selected.shipping_neighborhood}, ${selected.shipping_city} - ${selected.shipping_state}, CEP ${fmtZip(selected.shipping_zip)}`;
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}`;
            return (
            <div className="space-y-5">
              {/* Tier + seller */}
              <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Premiação</p>
                  <p className="text-foreground font-bold mt-1">{selected.tier_label}</p>
                  {selected.tier_value > 0 && <p className="text-muted-foreground text-[11px] tabular-nums">{fmtMoney(Number(selected.tier_value))}</p>}
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Seller</p>
                  <p className="text-foreground font-bold mt-1">{getName(selected.user_id)}</p>
                  <p className="text-muted-foreground text-[11px]">{getEmail(selected.user_id)}</p>
                  <button onClick={() => copy(selected.user_id, "User ID copiado")} className="text-[10px] text-muted-foreground hover:text-foreground font-mono mt-0.5">{selected.user_id.slice(0, 8)}…</button>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Recebedor</p>
                  <p className="text-foreground font-bold mt-1">{selected.recipient_name}</p>
                  <p className="text-muted-foreground text-[11px] flex items-center gap-1"><Phone className="h-3 w-3" /> {selected.phone}</p>
                  {selected.document && <p className="text-muted-foreground text-[11px] font-mono">{selected.document}</p>}
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Solicitada em</p>
                  <p className="text-foreground font-bold mt-1">{new Date(selected.created_at).toLocaleString("pt-BR")}</p>
                  {selected.delivered_at && (
                    <p className="text-emerald-400 text-[11px] mt-0.5">Entregue: {new Date(selected.delivered_at).toLocaleString("pt-BR")}</p>
                  )}
                </div>
              </div>

              {/* Address */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Endereço de envio</p>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => copy(fullAddr, "Endereço copiado!")}>
                      <Copy className="h-3 w-3" /> Copiar tudo
                    </Button>
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 h-6 px-2 text-[10px] rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5">
                      <MapIcon className="h-3 w-3" /> Maps
                    </a>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <Field label="CEP" value={fmtZip(selected.shipping_zip)} onCopy={() => copy(selected.shipping_zip, "CEP copiado")} mono />
                  <Field label="Cidade / UF" value={`${selected.shipping_city} - ${selected.shipping_state}`} />
                  <Field label="Rua" value={selected.shipping_street} onCopy={() => copy(selected.shipping_street, "Rua copiada")} />
                  <Field label="Número" value={selected.shipping_number} />
                  <Field label="Bairro" value={selected.shipping_neighborhood} />
                  <Field label="Complemento" value={selected.shipping_complement || "—"} />
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
                <div className="flex items-center gap-2 flex-wrap">
                  {selected.tracking_url && (
                    <a href={selected.tracking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> Abrir rastreio salvo
                    </a>
                  )}
                  {selected.tracking_code && (
                    <button onClick={() => copy(selected.tracking_code!, "Código copiado")} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                      <Copy className="h-3 w-3" /> Copiar código
                    </button>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2">
                {selected.status !== "delivered" && (
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() => { setEditStatus("delivered"); }}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como entregue
                  </Button>
                )}
                {selected.status !== "cancelled" && (
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10"
                    onClick={() => setConfirmCancel(selected)}>
                    <XCircle className="h-3.5 w-3.5" /> Cancelar solicitação
                  </Button>
                )}
              </div>
            </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>Fechar</Button>
            <Button onClick={saveClaim} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm cancel */}
      <AlertDialog open={!!confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar premiação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marca a solicitação como cancelada. O seller poderá ser notificado conforme as regras da plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmCancel) return;
                await updateStatus(confirmCancel, "cancelled");
                setConfirmCancel(null);
                setSelected(null);
              }}
            >Confirmar cancelamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value, onCopy, mono }: { label: string; value: string; onCopy?: () => void; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">{label}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <p className={cn("text-foreground truncate", mono && "font-mono")}>{value}</p>
        {onCopy && value && value !== "—" && (
          <button onClick={onCopy} className="text-muted-foreground hover:text-foreground shrink-0">
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
