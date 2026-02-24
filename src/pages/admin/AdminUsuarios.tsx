import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Search, Shield, Ban, CheckCircle2, Eye, MoreHorizontal, Activity, Package, Trash2, Edit, Plus, Clock } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Tables } from "@/integrations/supabase/types";

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  product_created: { label: "Produto Criado", color: "text-primary", icon: Plus },
  product_updated: { label: "Produto Editado", color: "text-info", icon: Edit },
  product_deleted: { label: "Produto Excluído", color: "text-destructive", icon: Trash2 },
  course_created: { label: "Curso Criado", color: "text-primary", icon: Plus },
  course_updated: { label: "Curso Editado", color: "text-info", icon: Edit },
  course_deleted: { label: "Curso Excluído", color: "text-destructive", icon: Trash2 },
};

export default function AdminUsuarios() {
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<Tables<"profiles"> | null>(null);
  const [userLogs, setUserLogs] = useState<ActivityLog[]>([]);
  const [userProducts, setUserProducts] = useState<Tables<"products">[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadProfiles = () => {
    supabase.from("profiles").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setProfiles(data); });
  };

  useEffect(() => { loadProfiles(); }, []);

  const openUserDetail = async (profile: Tables<"profiles">) => {
    setSelectedUser(profile);
    setLoadingLogs(true);
    const [logsRes, productsRes] = await Promise.all([
      supabase.from("activity_logs").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(100),
      supabase.from("products").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }),
    ]);
    if (logsRes.data) setUserLogs(logsRes.data as any);
    if (productsRes.data) setUserProducts(productsRes.data);
    setLoadingLogs(false);
  };

  const handleUserStatus = async (userId: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ account_status: status } as any).eq("user_id", userId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(`Conta ${status === "approved" ? "aprovada" : status === "blocked" ? "bloqueada" : "atualizada"}!`);
    loadProfiles();
  };

  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.full_name?.toLowerCase().includes(s)) || (p.email?.toLowerCase().includes(s)) || (p.document_number?.includes(s));
  });

  // Get deleted products from logs
  const deletedProducts = userLogs
    .filter(l => l.action === "product_deleted")
    .map(l => ({
      id: l.entity_id,
      name: l.old_data?.name || "Desconhecido",
      price: l.old_data?.price || 0,
      deletedAt: l.created_at,
      data: l.old_data
    }));

  return (
    <div className="space-y-6 dark">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Gestão de Usuários
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie todos os usuários da plataforma</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold mt-1">{profiles.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Com Documento</p>
          <p className="text-2xl font-bold mt-1 text-primary">{profiles.filter((p) => p.document_number).length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Com Telefone</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "hsl(var(--info))" }}>{profiles.filter((p) => p.phone).length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Hoje</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "hsl(var(--warning))" }}>
            {profiles.filter((p) => new Date(p.created_at).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, e-mail ou documento..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-4 font-medium">Usuário</th>
              <th className="text-left p-4 font-medium">Documento</th>
              <th className="text-left p-4 font-medium">Telefone</th>
              <th className="text-left p-4 font-medium">Cadastro</th>
              <th className="text-left p-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum usuário encontrado</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                        {(p.full_name || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{p.full_name || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">{p.email || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {p.document_number ? (
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{p.document_number}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pendente</span>
                    )}
                  </td>
                  <td className="p-4 text-sm">{p.phone || "—"}</td>
                  <td className="p-4 text-muted-foreground text-sm">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2" onClick={() => openUserDetail(p)}>
                          <Eye className="h-3.5 w-3.5" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-primary" onClick={() => handleUserStatus(p.user_id, "approved")}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar conta
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleUserStatus(p.user_id, "blocked")}>
                          <Ban className="h-3.5 w-3.5" /> Bloquear
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ User Detail Dialog ═══ */}
      <Dialog open={!!selectedUser} onOpenChange={v => { if (!v) setSelectedUser(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary">
                {(selectedUser?.full_name || "U").charAt(0).toUpperCase()}
              </div>
              <div>
                <span>{selectedUser?.full_name || "Sem nome"}</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">{selectedUser?.email}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="logs" className="mt-4">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="logs" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Logs de Atividade
              </TabsTrigger>
              <TabsTrigger value="products" className="gap-1.5">
                <Package className="h-3.5 w-3.5" /> Produtos Ativos
              </TabsTrigger>
              <TabsTrigger value="deleted" className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Produtos Excluídos
              </TabsTrigger>
            </TabsList>

            {/* Activity Logs */}
            <TabsContent value="logs" className="mt-4">
              {loadingLogs ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
              ) : userLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma atividade registrada</div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {userLogs.map(log => {
                    const meta = ACTION_LABELS[log.action] || { label: log.action, color: "text-muted-foreground", icon: Activity };
                    const Icon = meta.icon;
                    return (
                      <div key={log.id} className="rounded-xl border border-border p-3.5 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 ${meta.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`text-[13px] font-semibold ${meta.color}`}>{meta.label}</span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(log.created_at).toLocaleString("pt-BR")}
                              </span>
                            </div>

                            {/* Show data changes */}
                            {log.action === "product_deleted" && log.old_data && (
                              <div className="mt-2 rounded-lg bg-destructive/5 border border-destructive/10 p-2.5">
                                <p className="text-[11px] font-bold text-destructive mb-1">Dados do produto excluído:</p>
                                <div className="grid grid-cols-2 gap-1 text-[11px]">
                                  <span className="text-muted-foreground">Nome:</span>
                                  <span className="font-medium">{log.old_data.name}</span>
                                  <span className="text-muted-foreground">Preço:</span>
                                  <span className="font-medium">R$ {Number(log.old_data.price).toFixed(2)}</span>
                                  {log.old_data.checkout_url && (
                                    <>
                                      <span className="text-muted-foreground">Checkout:</span>
                                      <span className="font-mono text-[10px] truncate">{log.old_data.checkout_url}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            {log.action === "product_updated" && log.old_data && log.new_data && (
                              <div className="mt-2 rounded-lg bg-muted/30 border border-border p-2.5">
                                <p className="text-[11px] font-bold text-muted-foreground mb-1">Alterações:</p>
                                <div className="space-y-1 text-[11px]">
                                  {Object.keys(log.new_data).map(key => {
                                    if (log.old_data![key] === log.new_data![key]) return null;
                                    return (
                                      <div key={key} className="flex items-center gap-2">
                                        <span className="text-muted-foreground capitalize">{key}:</span>
                                        <span className="line-through text-destructive/60">{String(log.old_data![key] ?? "—")}</span>
                                        <span className="text-primary font-medium">→ {String(log.new_data![key] ?? "—")}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {log.action === "product_created" && log.new_data && (
                              <div className="mt-2 rounded-lg bg-primary/5 border border-primary/10 p-2.5">
                                <div className="grid grid-cols-2 gap-1 text-[11px]">
                                  <span className="text-muted-foreground">Nome:</span>
                                  <span className="font-medium">{log.new_data.name}</span>
                                  <span className="text-muted-foreground">Preço:</span>
                                  <span className="font-medium">R$ {Number(log.new_data.price).toFixed(2)}</span>
                                </div>
                              </div>
                            )}

                            {(log.action === "course_created" || log.action === "course_updated" || log.action === "course_deleted") && (
                              <div className="mt-2 rounded-lg bg-muted/30 border border-border p-2.5 text-[11px]">
                                {log.new_data && <span className="font-medium">{log.new_data.title}</span>}
                                {log.old_data && !log.new_data && <span className="font-medium">{log.old_data.title}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Active Products */}
            <TabsContent value="products" className="mt-4">
              {userProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Nenhum produto ativo</div>
              ) : (
                <div className="space-y-2">
                  {userProducts.map(p => (
                    <div key={p.id} className="rounded-xl border border-border p-3.5 flex items-center gap-3">
                      {p.image_url && (
                        <img src={p.image_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">{p.description?.slice(0, 60) || "Sem descrição"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-bold text-primary">R$ {Number(p.price).toFixed(2)}</p>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Deleted Products */}
            <TabsContent value="deleted" className="mt-4">
              {deletedProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Nenhum produto excluído registrado</div>
              ) : (
                <div className="space-y-2">
                  {deletedProducts.map((dp, i) => (
                    <div key={i} className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] font-semibold text-destructive flex items-center gap-1.5">
                            <Trash2 className="h-3 w-3" /> {dp.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Preço: R$ {Number(dp.price).toFixed(2)} • Excluído em {new Date(dp.deletedAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        {dp.data?.checkout_url && (
                          <span className="text-[10px] font-mono text-muted-foreground/50 truncate max-w-[200px]">{dp.data.checkout_url}</span>
                        )}
                      </div>
                      {dp.data?.description && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 border-t border-destructive/10 pt-1.5">{dp.data.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
