import { useState, useEffect, useMemo } from "react";
import {
  KeyRound, Plus, Copy, Shield, Search, Globe, Lock, Code2, Pencil, Trash2, BookOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [editName, setEditName] = useState("");


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

  const handleRename = async () => {
    if (!editingKey || !editName.trim()) return;
    const { error } = await supabase.functions.invoke("generate-api-key", {
      body: { action: "rename", keyId: editingKey.id, name: editName.trim() },
    });
    if (error) { toast.error("Erro ao renomear"); return; }
    toast.success("Nome atualizado");
    setEditingKey(null);
    fetchKeys();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir a credencial "${name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.functions.invoke("generate-api-key", {
      body: { action: "delete", keyId: id },
    });
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Credencial excluída");
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
        <div className="flex items-center gap-2">
          <Link to="/vendas/documentacao" className="h-11 px-4 rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <BookOpen className="h-4 w-4" /> Docs
          </Link>
          <Button onClick={() => setShowCreateDialog(true)} className="h-11 px-6 rounded-xl font-black text-xs uppercase tracking-widest gap-2">
            <Plus className="h-4 w-4" /> Gerar Nova Chave
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Shield, label: "Chaves Ativas", value: String(keys.filter(k => k.is_active).length), sub: "Operacionais" },
          { icon: Globe,  label: "Total Geradas", value: String(keys.length),                          sub: "Histórico completo" },
          { icon: Lock,   label: "Criptografia",  value: "SHA-256",                                    sub: "Secrets hasheadas" },
          { icon: Code2,  label: "Padrão",        value: "REST",                                       sub: "JSON · Bearer Auth" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card p-8 rounded-[24px] border border-border/60 shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-3">
                  <Icon size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.15em]">{card.label}</span>
                </div>
                <p className="text-3xl font-black text-foreground tabular-nums tracking-tighter">{card.value}</p>
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase mt-2 tracking-widest">{card.sub}</p>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg] group-hover:scale-110 transition-transform duration-500">
                <Icon size={160} />
              </div>
            </div>
          );
        })}
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
                <th className="px-8 py-5">Último Uso</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-[11px] font-black uppercase tracking-widest opacity-30">
                    Nenhuma credencial gerada
                  </td>
                </tr>
              ) : (
                filtered.map((k) => (
                  <tr key={k.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-8 py-5">
                      <p className="text-sm font-black text-foreground">{k.name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <code className="text-[10px] font-mono text-muted-foreground/70 truncate max-w-[280px]">{k.public_key}</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(k.public_key); toast.success("Chave pública copiada"); }}
                          className="p-1 rounded-md hover:bg-muted text-muted-foreground/60 hover:text-foreground transition-colors"
                          title="Copiar chave pública"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-bold text-foreground tabular-nums">
                        {k.last_used_at ? format(new Date(k.last_used_at), "dd MMM yyyy", { locale: ptBR }) : "—"}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">
                        {k.last_used_at ? format(new Date(k.last_used_at), "HH:mm", { locale: ptBR }) : "Nunca utilizada"}
                      </p>
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
                      <button
                        onClick={() => { setEditingKey(k); setEditName(k.name); }}
                        className="h-8 w-8 rounded-lg bg-muted/40 border border-border/60 inline-flex items-center justify-center hover:bg-muted transition-all"
                        title="Renomear"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(k.id, k.name)}
                        className="h-8 w-8 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive inline-flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-all"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
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