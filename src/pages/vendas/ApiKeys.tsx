import { useState, useEffect, useMemo } from "react";
import { KeyRound, Plus, Copy, Search, Pencil, Trash2, BookOpen } from "lucide-react";

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
  const [newKeyData, setNewKeyData] = useState<{ secret_key?: string } | null>(null);
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

  const activeCount = keys.filter(k => k.is_active).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header — clean */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight text-foreground">
            Credenciais API
          </h1>
          <p className="text-sm text-muted-foreground">
            Chaves publishable e secretas para autenticar requisições na API Venxpay.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/vendas/documentacao"
            className="h-10 px-3.5 rounded-lg border border-border/60 bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 inline-flex items-center gap-2 transition-colors"
          >
            <BookOpen className="h-4 w-4" /> Documentação
          </Link>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="h-10 px-4 rounded-lg text-sm font-medium gap-2"
          >
            <Plus className="h-4 w-4" /> Nova chave
          </Button>
        </div>
      </header>

      {/* Minimal metric strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 rounded-[12px] border border-border/60 bg-card divide-x divide-border/60">
        {[
          { label: "Credenciais", value: String(keys.length) },
          { label: "Ativas", value: String(activeCount) },
          { label: "Criptografia", value: "SHA-256" },
          { label: "Autenticação", value: "Bearer" },
        ].map((item, i) => (
          <div key={item.label} className={cn("px-5 py-4", i >= 2 && "hidden md:block")}>
            <p className="text-[11px] text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground tabular-nums tracking-tight">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-[12px] border border-border/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Suas credenciais</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {keys.length === 0 ? "Nenhuma chave gerada" : `${keys.length} ${keys.length === 1 ? "chave" : "chaves"}`}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={14} />
            <input
              type="text"
              placeholder="Buscar por nome…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-background border border-border/60 rounded-lg text-sm focus:outline-none focus:border-border"
            />
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border/60">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-4 space-y-2 animate-pulse">
                <div className="h-4 w-32 rounded bg-muted/60" />
                <div className="h-8 rounded bg-muted/30" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <KeyRound size={20} className="mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-sm text-foreground">Nenhuma credencial ainda</p>
              <p className="text-xs text-muted-foreground mt-1">Gere uma chave para integrar via API.</p>
            </div>
          ) : (
            filtered.map((k) => (
              <div key={k.id} className="px-4 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{k.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {k.last_used_at ? `Usada ${format(new Date(k.last_used_at), "dd MMM HH:mm", { locale: ptBR })}` : "Nunca utilizada"}
                    </p>
                  </div>
                  <span className={cn(
 "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium",
                    k.is_active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", k.is_active ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                    {k.is_active ? "Ativa" : "Revogada"}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 border border-border/60 px-2.5 py-1.5">
                  <code className="flex-1 text-[11px] font-mono text-muted-foreground truncate">{k.public_key}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(k.public_key); toast.success("Chave pública copiada"); }}
                    className="h-6 w-6 rounded-md hover:bg-background inline-flex items-center justify-center text-muted-foreground"
                  >
                    <Copy size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingKey(k); setEditName(k.name); }}
                    className="flex-1 h-8 rounded-lg border border-border/60 text-xs text-foreground inline-flex items-center justify-center gap-1.5 hover:bg-muted/40"
                  >
                    <Pencil size={12} /> Renomear
                  </button>
                  <button
                    onClick={() => handleDelete(k.id, k.name)}
                    className="h-8 w-8 rounded-lg border border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/40 inline-flex items-center justify-center"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border/60">
                <th className="px-5 py-3 font-medium">Nome / Chave pública</th>
                <th className="px-5 py-3 font-medium">Último uso</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4"><div className="h-4 w-40 rounded bg-muted/60" /></td>
                    <td className="px-5 py-4"><div className="h-4 w-20 rounded bg-muted/60" /></td>
                    <td className="px-5 py-4"><div className="h-4 w-14 rounded bg-muted/60" /></td>
                    <td className="px-5 py-4"><div className="h-4 w-16 ml-auto rounded bg-muted/60" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center">
                    <KeyRound size={20} className="mx-auto text-muted-foreground/40" />
                    <p className="mt-3 text-sm text-foreground">Nenhuma credencial gerada</p>
                    <p className="text-xs text-muted-foreground mt-1">Clique em "Nova chave" para começar.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((k) => (
                  <tr key={k.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-foreground">{k.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-[11px] font-mono text-muted-foreground truncate max-w-[300px]">{k.public_key}</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(k.public_key); toast.success("Chave pública copiada"); }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors"
                          title="Copiar chave pública"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground tabular-nums">
                      {k.last_used_at
                        ? format(new Date(k.last_used_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })
                        : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn(
 "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium",
                        k.is_active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                      )}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", k.is_active ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                        {k.is_active ? "Ativa" : "Revogada"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => { setEditingKey(k); setEditName(k.name); }}
                          className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Renomear"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(k.id, k.name)}
                          className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md bg-card border-border/60 rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Nova credencial</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Escolha um nome para identificar essa chave.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Nome da chave</Label>
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Ex: App Produção"
                className="h-10 rounded-lg"
              />
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full h-10 rounded-lg">
              {creating ? "Gerando…" : "Gerar credencial"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Secret reveal dialog */}
      <Dialog open={!!newKeyData} onOpenChange={() => setNewKeyData(null)}>
        <DialogContent className="max-w-lg bg-card border-border/60 rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Credencial gerada</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Copie a <code className="font-mono text-foreground">secret key</code> agora. Por segurança, ela não será exibida novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
              <p className="text-[11px] text-muted-foreground mb-2">Secret key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs text-foreground truncate">{newKeyData?.secret_key}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(newKeyData?.secret_key ?? ""); toast.success("Copiado!"); }}
                  className="h-8 w-8 rounded-lg bg-background border border-border/60 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <Button onClick={() => setNewKeyData(null)} className="w-full h-10 rounded-lg">
              Já salvei minha chave
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!editingKey} onOpenChange={(o) => !o && setEditingKey(null)}>
        <DialogContent className="max-w-md bg-card border-border/60 rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Renomear credencial</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Apenas o nome de exibição é alterado. As chaves continuam as mesmas.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Novo nome</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ex: Produção"
                className="h-10 rounded-lg"
                autoFocus
              />
            </div>
            <Button onClick={handleRename} disabled={!editName.trim()} className="w-full h-10 rounded-lg">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
