import { useState, useEffect } from "react";
import { Key, Plus, Copy, Check, Trash2, ShieldOff, Eye, EyeOff, AlertTriangle, Shield } from "lucide-react";
import { PageShell, PageTitle, Panel } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

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
    <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
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
    
    if (!error && data) {
      setKeys(data as ApiKey[]);
    }
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
      if (res.error || !res.data?.success) {
        toast.error("Erro ao revogar chave");
        return;
      }
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
      if (res.error || !res.data?.success) {
        toast.error("Erro ao deletar chave");
        return;
      }
      fetchKeys();
      toast.success("Chave deletada!");
    } catch {
      toast.error("Erro ao deletar");
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-2">
        <PageTitle icon={<Key className="h-6 w-6" />} title="Chaves da API" subtitle="Gerencie suas credenciais de acesso à API" />
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2 rounded-xl h-10 text-[12px] font-semibold">
          <Plus className="h-4 w-4" /> Nova Chave
        </Button>
      </div>

      {/* Security Warning */}
      <div className="rounded-2xl border border-warning/20 bg-warning/[0.04] p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="text-[12px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Segurança:</strong> A Secret Key é exibida apenas uma vez no momento da criação. Guarde-a em local seguro. Nunca exponha suas chaves no frontend ou repositórios públicos.
        </div>
      </div>

      {/* Keys List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center">
            <div className="h-7 w-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground">Carregando chaves...</p>
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card/80 p-12 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Key className="h-7 w-7 text-primary" />
            </div>
            <p className="text-foreground font-semibold mb-1">Nenhuma chave API</p>
            <p className="text-muted-foreground text-[13px] mb-4">Crie sua primeira chave para começar a integrar</p>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" /> Criar Primeira Chave
            </Button>
          </div>
        ) : (
          keys.map((key, i) => (
            <motion.div
              key={key.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "rounded-2xl border bg-card/80 backdrop-blur-xl p-5 transition-all",
                key.is_active ? "border-border/40" : "border-destructive/20 opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "h-8 w-8 rounded-xl flex items-center justify-center",
                      key.is_active ? "bg-success/10" : "bg-destructive/10"
                    )}>
                      {key.is_active ? <Shield className="h-4 w-4 text-success" /> : <ShieldOff className="h-4 w-4 text-destructive" />}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-foreground">{key.name}</p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {key.is_active ? "Ativa" : "Revogada"} · Criada em {fmtDate(key.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Keys display */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="rounded-xl bg-muted/20 border border-border/20 px-3 py-2.5">
                      <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-1">Public Key</p>
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono text-primary flex-1 truncate">{key.public_key}</code>
                        <CopyButton value={key.public_key} label="Public Key" />
                      </div>
                    </div>
                    <div className="rounded-xl bg-muted/20 border border-border/20 px-3 py-2.5">
                      <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-1">Secret Key</p>
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono text-muted-foreground flex-1">{key.secret_key_prefix}••••••••••••</code>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {key.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(key.id)}
                      disabled={revokingId === key.id}
                      className="text-warning hover:text-warning hover:bg-warning/10 rounded-xl h-9 px-3 text-[11px]"
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(key.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl h-9 px-3 text-[11px]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md border-border/40 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" /> Nova Chave API
            </DialogTitle>
            <DialogDescription>Crie uma nova credencial para acessar a API</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[12px] font-semibold">Nome da Chave</Label>
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Ex: Produção, Teste, Site..."
                className="mt-1.5 rounded-xl"
                maxLength={100}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="flex-1 rounded-xl">Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !newKeyName.trim()} className="flex-1 rounded-xl gap-2">
              {creating ? <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Plus className="h-4 w-4" />}
              Gerar Chaves
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Key Created Dialog */}
      <Dialog open={!!newKeyData} onOpenChange={() => setNewKeyData(null)}>
        <DialogContent className="sm:max-w-lg border-border/40 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <Check className="h-5 w-5" /> Chave Criada com Sucesso
            </DialogTitle>
            <DialogDescription>Copie a Secret Key agora — ela não será exibida novamente!</DialogDescription>
          </DialogHeader>
          {newKeyData && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-border/30 bg-muted/10 p-4 space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1">Public Key</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[12px] font-mono text-primary flex-1 break-all">{newKeyData.public_key}</code>
                    <CopyButton value={newKeyData.public_key} label="Public Key" />
                  </div>
                </div>
                <div className="border-t border-border/20 pt-3">
                  <p className="text-[10px] font-bold text-destructive/80 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Secret Key (copie agora!)
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-[12px] font-mono text-foreground flex-1 break-all">
                      {showSecret ? newKeyData.secret_key : newKeyData.secret_key.slice(0, 12) + "•".repeat(36)}
                    </code>
                    <button onClick={() => setShowSecret(!showSecret)} className="p-1.5 rounded-lg hover:bg-muted/50">
                      {showSecret ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    <CopyButton value={newKeyData.secret_key} label="Secret Key" />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] p-3">
                <p className="text-[11px] text-muted-foreground flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span><strong className="text-foreground">Atenção:</strong> A Secret Key não poderá ser visualizada novamente. Guarde-a em um local seguro antes de fechar esta janela.</span>
                </p>
              </div>
            </div>
          )}
          <Button onClick={() => { setNewKeyData(null); setShowSecret(false); }} className="rounded-xl">
            Entendi, já copiei a chave
          </Button>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
