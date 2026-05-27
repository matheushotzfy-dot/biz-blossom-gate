/**
 * API Keys — Editorial Two-Column Manager
 * Stripe-inspired dense layout. No glow, no orbs, no enter animations.
 */
import { useState, useEffect, useMemo } from "react";
import {
  KeyRound, Plus, Copy, Check, Trash2, ShieldOff, Eye, EyeOff,
  AlertTriangle, Shield, Search, MoreHorizontal, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface ApiKey {
  id: string;
  name: string;
  public_key: string;
  secret_key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface NewKeyData {
  id: string; name: string; public_key: string;
  secret_key: string; secret_key_prefix: string;
  is_active: boolean; created_at: string;
}

function CopyInline({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(`${label || "Valor"} copiado`);
        setTimeout(() => setCopied(false), 1600);
      }}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/40 text-muted-foreground transition-colors hover:border-border hover:text-foreground",
        className,
      )}
      title="Copiar"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function relTime(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function ApiKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("Produção");
  const [newKeyData, setNewKeyData] = useState<NewKeyData | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchKeys = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("api_keys")
      .select("id, name, public_key, secret_key_prefix, is_active, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) {
      setKeys(data as ApiKey[]);
      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
    }
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); /* eslint-disable-next-line */ }, [user]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("generate-api-key", {
        body: { action: "create", name: newKeyName },
      });
      if (res.error || !res.data?.success) {
        toast.error(res.data?.error || "Erro ao criar chave");
        return;
      }
      setNewKeyData(res.data.data);
      setShowCreateDialog(false);
      fetchKeys();
    } catch { toast.error("Erro ao criar chave"); }
    finally { setCreating(false); }
  };

  const handleRevoke = async (keyId: string) => {
    setActingId(keyId);
    try {
      const res = await supabase.functions.invoke("generate-api-key", { body: { action: "revoke", keyId } });
      if (res.error || !res.data?.success) { toast.error("Erro ao revogar"); return; }
      fetchKeys();
      toast.success("Chave revogada");
    } finally { setActingId(null); }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm("Excluir esta credencial permanentemente?")) return;
    setActingId(keyId);
    try {
      const res = await supabase.functions.invoke("generate-api-key", { body: { action: "delete", keyId } });
      if (res.error || !res.data?.success) { toast.error("Erro ao excluir"); return; }
      if (selectedId === keyId) setSelectedId(null);
      fetchKeys();
      toast.success("Chave excluída");
    } finally { setActingId(null); }
  };

  const filtered = useMemo(
    () => keys.filter(k => !query || k.name.toLowerCase().includes(query.toLowerCase())),
    [keys, query],
  );
  const selected = keys.find(k => k.id === selectedId) || null;
  const active = keys.filter(k => k.is_active).length;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6 pt-6 pb-20">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 pb-5 mb-5 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground/70 mb-1.5">
            <KeyRound className="h-3 w-3" />
            <span className="uppercase tracking-[0.14em]">Integrações</span>
            <span className="text-border">/</span>
            <span className="text-foreground/80">Credenciais API</span>
          </div>
          <h1 className="text-[22px] font-heading font-bold tracking-[-0.02em] text-foreground">
            Chaves de API
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {keys.length} credencial{keys.length !== 1 && "is"} · {active} ativa{active !== 1 && "s"} ·
            Use chaves <code className="font-mono text-foreground/80">sk_live_…</code> em chamadas server-to-server.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova chave
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-0 border border-border/60 rounded-xl overflow-hidden bg-card">
        {/* LEFT — list */}
        <aside className="border-r border-border/60 bg-background/30 flex flex-col min-h-[560px]">
          <div className="p-3 border-b border-border/60">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar credencial..."
                className="h-9 pl-8 text-[13px] bg-background/60 border-border/50 rounded-lg"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-[12px] text-muted-foreground">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[13px] text-foreground/80 font-medium mb-1">Nenhuma credencial</p>
                <p className="text-[12px] text-muted-foreground">Crie uma chave para começar a integrar.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {filtered.map((k) => {
                  const isSel = k.id === selectedId;
                  return (
                    <li key={k.id}>
                      <button
                        onClick={() => setSelectedId(k.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors",
                          isSel ? "bg-primary/8 border-l-2 border-l-primary -ml-px" : "hover:bg-muted/30 border-l-2 border-l-transparent -ml-px",
                        )}
                      >
                        <div className={cn(
                          "h-2 w-2 rounded-full mt-2 shrink-0",
                          k.is_active ? "bg-success" : "bg-muted-foreground/30",
                        )} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13px] font-semibold text-foreground truncate">{k.name}</p>
                            <span className={cn(
                              "shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                              k.is_active
                                ? "border-success/30 text-success bg-success/5"
                                : "border-border/60 text-muted-foreground bg-muted/30",
                            )}>
                              {k.is_active ? "ativa" : "revogada"}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate">
                            {k.secret_key_prefix}••••••••
                          </p>
                          <p className="text-[10.5px] text-muted-foreground/70 mt-0.5">
                            Último uso · {relTime(k.last_used_at)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* RIGHT — detail */}
        <section className="bg-card min-h-[560px]">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="h-12 w-12 rounded-xl border border-border/60 bg-background/40 flex items-center justify-center mb-3">
                <KeyRound className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[14px] font-semibold text-foreground">Selecione uma credencial</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Os detalhes aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="p-6">
              {/* Title row */}
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-border/60 mb-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[17px] font-heading font-bold text-foreground tracking-[-0.01em]">
                      {selected.name}
                    </h2>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                      selected.is_active
                        ? "border-success/30 text-success bg-success/5"
                        : "border-border/60 text-muted-foreground bg-muted/30",
                    )}>
                      {selected.is_active ? "Ativa" : "Revogada"}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-1 font-mono">
                    ID · {selected.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selected.is_active && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => handleRevoke(selected.id)}
                      disabled={actingId === selected.id}
                      className="h-8 gap-1.5 text-warning border-warning/30 hover:bg-warning/5"
                    >
                      <ShieldOff className="h-3.5 w-3.5" /> Revogar
                    </Button>
                  )}
                  <Button
                    variant="outline" size="sm"
                    onClick={() => handleDelete(selected.id)}
                    disabled={actingId === selected.id}
                    className="h-8 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                </div>
              </div>

              {/* Metadata grid */}
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 mb-6">
                {[
                  { label: "Criada em", value: new Date(selected.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) },
                  { label: "Último uso", value: relTime(selected.last_used_at) },
                  { label: "Permissões", value: "Leitura e escrita" },
                  { label: "Ambiente", value: "Produção" },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1">
                      {item.label}
                    </dt>
                    <dd className="text-[13px] font-medium text-foreground">{item.value}</dd>
                  </div>
                ))}
              </dl>

              {/* Keys */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      Public key
                    </Label>
                    <span className="text-[10px] text-muted-foreground/70">use no frontend</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                    <code className="flex-1 text-[12.5px] font-mono text-foreground truncate">
                      {selected.public_key}
                    </code>
                    <CopyInline value={selected.public_key} label="Public key" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      Secret key
                    </Label>
                    <span className="text-[10px] text-warning">apenas server-to-server</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                    <code className="flex-1 text-[12.5px] font-mono text-muted-foreground truncate">
                      {selected.secret_key_prefix}{"•".repeat(32)}
                    </code>
                    <span className="text-[10.5px] text-muted-foreground/70 pr-1">oculta após criação</span>
                  </div>
                </div>
              </div>

              {/* Security note */}
              <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-border/60 bg-background/30 px-3.5 py-3">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  A secret key completa é exibida <strong className="text-foreground">apenas uma vez</strong> no momento da criação.
                  Se perdeu, revogue e gere uma nova. Nunca exponha em código frontend ou repositórios públicos.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova credencial</DialogTitle>
            <DialogDescription>
              Dê um nome descritivo para identificar onde esta chave será usada.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Nome</Label>
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Ex: Produção, App Mobile, Worker..."
              className="mt-1.5 h-10"
              maxLength={100}
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newKeyName.trim()} className="flex-1 gap-2">
              {creating ? "Gerando..." : <><Plus className="h-4 w-4" />Gerar chave</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reveal once dialog */}
      <Dialog open={!!newKeyData} onOpenChange={() => { setNewKeyData(null); setShowSecret(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <Check className="h-4 w-4" /> Credencial gerada
            </DialogTitle>
            <DialogDescription>
              Copie a secret key agora — não será exibida novamente.
            </DialogDescription>
          </DialogHeader>
          {newKeyData && (
            <div className="space-y-3 py-1">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Public key</Label>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                  <code className="flex-1 text-[12.5px] font-mono text-foreground break-all">{newKeyData.public_key}</code>
                  <CopyInline value={newKeyData.public_key} label="Public key" />
                </div>
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-warning flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" /> Secret key — copie agora
                </Label>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5">
                  <code className="flex-1 text-[12.5px] font-mono text-foreground break-all">
                    {showSecret ? newKeyData.secret_key : newKeyData.secret_key.slice(0, 14) + "•".repeat(38)}
                  </code>
                  <button
                    type="button"
                    onClick={() => setShowSecret(s => !s)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <CopyInline value={newKeyData.secret_key} label="Secret key" />
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2 mt-1"
                onClick={() => {
                  const env = `HOTZFY_PUBLIC_KEY=${newKeyData.public_key}\nHOTZFY_SECRET_KEY=${newKeyData.secret_key}\n`;
                  const blob = new Blob([env], { type: "text/plain" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `hotzfy-${newKeyData.name.toLowerCase().replace(/\s+/g, "-")}.env`;
                  a.click();
                }}
              >
                <Download className="h-4 w-4" /> Baixar .env
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
