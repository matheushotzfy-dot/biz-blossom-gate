import { useState, useEffect, useMemo } from "react";
import {
  KeyRound, Plus, Copy, Check, Trash2, ShieldOff, Eye, EyeOff,
  AlertTriangle, Shield, Search, MoreHorizontal, Download, Globe, Lock, Code2, Power, PowerOff
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
import { StatCard } from "@/components/StatCard";

interface ApiKey {
  id: string;
  name: string;
  public_key: string;
  secret_key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export default function ApiKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("Produção");
  const [newKeyData, setNewKeyData] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchKeys = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("api_keys")
      .select("id, name, public_key, secret_key_prefix, is_active, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setKeys(data as ApiKey[]);
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, [user]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-api-key", {
        body: { action: "create", name: newKeyName },
      });
      if (error || !data?.success) { toast.error("Erro ao criar chave"); return; }
      setNewKeyData(data.data);
      setShowCreateDialog(false);
      fetchKeys();
    } finally { setCreating(false); }
  };

  const handleRevoke = async (id: string, active: boolean) => {
    const { error } = await supabase.functions.invoke("generate-api-key", { 
      body: { action: "revoke", keyId: id } 
    });
    if (error) { toast.error("Erro ao alterar"); return; }
    toast.success(active ? "Revogada" : "Ativada");
    fetchKeys();
  };

  const filtered = useMemo(() => 
    keys.filter(k => !query || k.name.toLowerCase().includes(query.toLowerCase())),
    [keys, query]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">Credenciais API</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-primary" />
            Acesse nossa infraestrutura via integração direta
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="h-11 px-6 rounded-xl font-black text-xs uppercase tracking-widest gap-2">
          <Plus className="h-4 w-4" /> Gerar Nova Chave
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Chaves Ativas" value={keys.filter(k => k.is_active).length} icon={Shield} color="success" description="Operacionais" />
        <StatCard title="Uso Recente" value="Ativo" icon={Globe} color="info" description="Tráfego detectado" />
        <StatCard title="Segurança" value="AES-256" icon={Lock} color="primary" description="Criptografia militar" />
        <StatCard title="Endpoints" value="REST" icon={Code2} color="neutral" description="Padrão JSON" />
      </div>

      {/* Table Section */}
      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <KeyRound size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Minhas Credenciais</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Sua ponte com a Hotzfy</p>
            </div>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nome..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-11 pl-11 pr-4 bg-muted/30 border border-border/60 rounded-xl text-sm font-bold focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/30 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 border-b border-border/40">
                <th className="px-8 py-5">Nome / Chave Pública</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-8 py-20 text-center text-[11px] font-black uppercase tracking-widest opacity-30">
                    Nenhuma credencial gerada
                  </td>
                </tr>
              ) : (
                filtered.map((k) => (
                  <tr key={k.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-8 py-5">
                      <p className="text-sm font-black text-foreground">{k.name}</p>
                      <code className="text-[10px] font-mono text-muted-foreground/60 mt-1">{k.public_key}</code>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex justify-center">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                          k.is_active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-muted text-muted-foreground border-border/60"
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", k.is_active ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                          {k.is_active ? "Ativa" : "Revogada"}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right space-x-2">
                      <button onClick={() => handleRevoke(k.id, k.is_active)} className="h-8 w-8 rounded-lg bg-muted/40 border border-border/60 inline-flex items-center justify-center hover:bg-muted transition-all">
                        {k.is_active ? <PowerOff size={14} /> : <Power size={14} className="text-emerald-500" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md bg-card border-border/60 rounded-[32px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Nova Credencial</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome da Chave</Label>
              <Input 
                value={newKeyName} 
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Ex: App Produção"
                className="h-12 border-border/60 rounded-xl font-bold"
              />
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs">
              {creating ? "Gerando..." : "Gerar Credencial"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newKeyData} onOpenChange={() => setNewKeyData(null)}>
        <DialogContent className="max-w-lg bg-card border-border/60 rounded-[32px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-emerald-500">Credencial Gerada</DialogTitle>
            <DialogDescription className="text-xs">
              Copie sua <code className="font-bold">Secret Key</code> agora. Ela não será exibida novamente por segurança.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/60">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Secret Key</p>
              <div className="flex items-center gap-3">
                 <code className="flex-1 font-mono text-xs text-foreground font-bold truncate">{newKeyData?.secret_key}</code>
                 <button onClick={() => { navigator.clipboard.writeText(newKeyData?.secret_key); toast.success("Copiado!"); }} className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/10">
                    <Copy size={16} />
                 </button>
              </div>
            </div>
            <Button onClick={() => setNewKeyData(null)} className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs">
              Já salvei minha chave
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}