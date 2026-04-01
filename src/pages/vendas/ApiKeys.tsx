import { useState, useEffect } from "react";
import { KeyRound, Plus, Copy, Check, Trash2, ShieldOff, Eye, EyeOff, AlertTriangle, Shield, Clock, Fingerprint, Zap } from "lucide-react";
import { PageShell, PageTitle } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion } from "framer-motion";

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
  id: string;
  name: string;
  public_key: string;
  secret_key: string;
  secret_key_prefix: string;
  is_active: boolean;
  created_at: string;
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(label ? `${label} copiada!` : "Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-primary/10 transition-all duration-200 group/copy">
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover/copy:text-primary transition-colors" />}
    </button>
  );
}

function KeyField({ label, value, mono, copyLabel, accent }: { label: string; value: string; mono?: boolean; copyLabel?: string; accent?: boolean }) {
  return (
    <div className="group relative rounded-xl bg-background/60 border border-border/30 hover:border-border/60 px-4 py-3 transition-all duration-200">
      <p className={cn(
        "text-[9px] font-bold uppercase tracking-[0.12em] mb-1.5",
        accent ? "text-primary/70" : "text-muted-foreground/40"
      )}>{label}</p>
      <div className="flex items-center gap-2">
        <code className={cn(
          "text-[11px] flex-1 truncate",
          mono && "font-mono",
          accent ? "text-primary font-semibold" : "text-muted-foreground"
        )}>{value}</code>
        {copyLabel && <CopyButton value={value} label={copyLabel} />}
      </div>
    </div>
  );
}

export default function ApiKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("Produção");
  const [newKeyData, setNewKeyData] = useState<NewKeyData | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchKeys = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, public_key, secret_key_prefix, is_active, created_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setKeys(data as ApiKey[]);
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, [user]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }
      const res = await supabase.functions.invoke('generate-api-key', {
        body: { action: 'create', name: newKeyName },
      });
      if (res.error || !res.data?.success) {
        toast.error(res.data?.error || "Erro ao criar chave");
        return;
      }
      setNewKeyData(res.data.data);
      setShowCreateDialog(false);
      fetchKeys();
      toast.success("Chave API criada com sucesso!");
    } catch {
      toast.error("Erro ao criar chave");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      const res = await supabase.functions.invoke('generate-api-key', {
        body: { action: 'revoke', keyId },
      });
      if (res.error || !res.data?.success) { toast.error("Erro ao revogar chave"); return; }
      fetchKeys();
      toast.success("Chave revogada!");
    } catch {
      toast.error("Erro ao revogar");
    } finally {
      setRevokingId(null);
    }
  };

  const handleDelete = async (keyId: string) => {
    try {
      const res = await supabase.functions.invoke('generate-api-key', {
        body: { action: 'delete', keyId },
      });
      if (res.error || !res.data?.success) { toast.error("Erro ao deletar chave"); return; }
      fetchKeys();
      toast.success("Chave deletada!");
    } catch {
      toast.error("Erro ao deletar");
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  const activeKeys = keys.filter(k => k.is_active).length;
  const revokedKeys = keys.filter(k => !k.is_active).length;

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-foreground tracking-tight font-heading">Credenciais da API</h1>
              <p className="text-[12px] text-muted-foreground/60">Gerencie suas chaves de acesso à API PodPay</p>
            </div>
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2 rounded-xl h-10 px-5 text-[12px] font-semibold shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all">
          <Plus className="h-4 w-4" /> Nova Credencial
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total de Chaves", value: keys.length, icon: KeyRound, color: "text-primary" },
          { label: "Ativas", value: activeKeys, icon: Shield, color: "text-success" },
          { label: "Revogadas", value: revokedKeys, icon: ShieldOff, color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm p-4 flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-xl bg-background/80 border border-border/20 flex items-center justify-center", s.color)}>
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[22px] font-bold font-heading tabular-nums text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground/50 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Security Banner */}
      <div className="rounded-2xl border border-warning/15 bg-warning/[0.03] p-4 flex items-start gap-3.5">
        <div className="h-8 w-8 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
          <Fingerprint className="h-4 w-4 text-warning" />
        </div>
        <div className="text-[11px] text-muted-foreground/70 leading-relaxed">
          <strong className="text-foreground/90 text-[12px]">Segurança</strong>
          <p className="mt-0.5">A Secret Key é exibida <strong className="text-foreground/80">apenas uma vez</strong> no momento da criação. Nunca exponha suas chaves em código frontend ou repositórios públicos.</p>
        </div>
      </div>

      {/* Keys List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-16 text-center">
            <div className="h-8 w-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[12px] text-muted-foreground/50">Carregando credenciais...</p>
          </div>
        ) : keys.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-dashed border-border/40 bg-card/40 p-16 text-center"
          >
            <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-5">
              <Zap className="h-7 w-7 text-primary" />
            </div>
            <p className="text-foreground font-bold text-[15px] mb-1.5">Comece a integrar</p>
            <p className="text-muted-foreground/50 text-[12px] max-w-[280px] mx-auto mb-5">Gere suas credenciais para autenticar chamadas à API e processar transações PIX em tempo real.</p>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2 rounded-xl shadow-lg shadow-primary/10">
              <Plus className="h-4 w-4" /> Gerar Primeira Credencial
            </Button>
          </motion.div>
        ) : (
          keys.map((key, i) => (
            <motion.div
              key={key.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className={cn(
                "group rounded-2xl border bg-card/70 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:bg-card/90",
                key.is_active
                  ? "border-border/30 hover:border-border/50 hover:shadow-lg hover:shadow-primary/[0.03]"
                  : "border-destructive/15 opacity-50 hover:opacity-70"
              )}
            >
              {/* Accent bar */}
              <div className={cn("h-[2px]", key.is_active ? "bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" : "bg-destructive/20")} />

              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-xl border flex items-center justify-center transition-colors",
                      key.is_active
                        ? "bg-success/[0.06] border-success/15 text-success"
                        : "bg-destructive/[0.06] border-destructive/15 text-destructive"
                    )}>
                      {key.is_active ? <Shield className="h-4.5 w-4.5" /> : <ShieldOff className="h-4.5 w-4.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-bold text-foreground">{key.name}</p>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                          key.is_active
                            ? "bg-success/10 text-success border border-success/20"
                            : "bg-destructive/10 text-destructive border border-destructive/20"
                        )}>
                          {key.is_active ? "Ativa" : "Revogada"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Criada {fmtDate(key.created_at)} às {fmtTime(key.created_at)}
                        </span>
                        {key.last_used_at && (
                          <span className="text-[10px] text-muted-foreground/40">
                            · Último uso {fmtDate(key.last_used_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {key.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(key.id)}
                        disabled={revokingId === key.id}
                        className="text-warning hover:text-warning hover:bg-warning/10 rounded-xl h-8 w-8 p-0"
                        title="Revogar chave"
                      >
                        {revokingId === key.id
                          ? <div className="h-3.5 w-3.5 border-2 border-warning/30 border-t-warning rounded-full animate-spin" />
                          : <ShieldOff className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(key.id)}
                      className="text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-xl h-8 w-8 p-0"
                      title="Deletar chave"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Key Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <KeyField label="Public Key" value={key.public_key} mono copyLabel="Public Key" accent />
                  <KeyField label="Secret Key" value={`${key.secret_key_prefix}${"•".repeat(16)}`} mono />
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md border-border/30 bg-card/95 backdrop-blur-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-[16px]">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <KeyRound className="h-4 w-4 text-primary" />
              </div>
              Nova Credencial
            </DialogTitle>
            <DialogDescription className="text-[12px]">Dê um nome para identificar esta credencial</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">Nome</Label>
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Ex: Produção, Staging, App Mobile..."
                className="mt-1.5 rounded-xl h-11 bg-background/60"
                maxLength={100}
                autoFocus
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="flex-1 rounded-xl h-10 border-border/30">Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !newKeyName.trim()} className="flex-1 rounded-xl h-10 gap-2 shadow-lg shadow-primary/10">
              {creating ? <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Zap className="h-4 w-4" />}
              Gerar Credencial
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Key Created Dialog */}
      <Dialog open={!!newKeyData} onOpenChange={() => setNewKeyData(null)}>
        <DialogContent className="sm:max-w-lg border-border/30 bg-card/95 backdrop-blur-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-success text-[16px]">
              <div className="h-8 w-8 rounded-xl bg-success/10 flex items-center justify-center">
                <Check className="h-4 w-4" />
              </div>
              Credencial Gerada
            </DialogTitle>
            <DialogDescription className="text-[12px]">Copie a Secret Key agora — ela não será exibida novamente</DialogDescription>
          </DialogHeader>
          {newKeyData && (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-border/20 bg-background/40 p-5 space-y-4">
                <div>
                  <p className="text-[9px] font-bold text-primary/50 uppercase tracking-[0.12em] mb-1.5">Public Key</p>
                  <div className="flex items-center gap-2 rounded-xl bg-background/60 border border-border/20 px-3 py-2.5">
                    <code className="text-[12px] font-mono text-primary flex-1 break-all font-semibold">{newKeyData.public_key}</code>
                    <CopyButton value={newKeyData.public_key} label="Public Key" />
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-destructive/60 uppercase tracking-[0.12em] mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Secret Key — copie agora
                  </p>
                  <div className="flex items-center gap-2 rounded-xl bg-destructive/[0.03] border border-destructive/15 px-3 py-2.5">
                    <code className="text-[12px] font-mono text-foreground flex-1 break-all">
                      {showSecret ? newKeyData.secret_key : newKeyData.secret_key.slice(0, 12) + "•".repeat(36)}
                    </code>
                    <button onClick={() => setShowSecret(!showSecret)} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                      {showSecret ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    <CopyButton value={newKeyData.secret_key} label="Secret Key" />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-destructive/15 bg-destructive/[0.03] p-3.5 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-destructive/70 shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                  <strong className="text-foreground/80">Atenção:</strong> Esta é a única vez que a Secret Key será exibida. Guarde-a em um gerenciador de senhas ou cofre seguro.
                </p>
              </div>
            </div>
          )}
          <Button onClick={() => { setNewKeyData(null); setShowSecret(false); }} className="rounded-xl h-10 shadow-lg shadow-primary/10">
            Entendi, já copiei a chave
          </Button>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}