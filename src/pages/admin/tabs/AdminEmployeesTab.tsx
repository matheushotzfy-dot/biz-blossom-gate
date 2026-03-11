import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  UserCog, Search, Plus, Trash2, Shield, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle } from "./AdminOverviewTab";
import { logAdminAction } from "@/lib/auditLog";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
}

interface Props {
  profiles: Tables<"profiles">[];
  onReload: () => void;
}

export default function AdminEmployeesTab({ profiles, onReload }: Props) {
  const [employees, setEmployees] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [foundUser, setFoundUser] = useState<Tables<"profiles"> | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    setLoading(true);
    const { data } = await supabase.from("user_roles").select("*").eq("role", "employee");
    if (data) setEmployees(data as UserRole[]);
    setLoading(false);
  };

  const searchUser = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setFoundUser(null);
    const profile = profiles.find(p => p.email?.toLowerCase() === searchEmail.toLowerCase().trim());
    if (profile) {
      const existing = employees.find(e => e.user_id === profile.user_id);
      if (existing) { toast.error("Este usuário já é um funcionário"); setSearching(false); return; }
      setFoundUser(profile);
    } else {
      toast.error("Usuário não encontrado");
    }
    setSearching(false);
  };

  const addEmployee = async () => {
    if (!foundUser) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: foundUser.user_id, role: "employee" as any });
    if (error) {
      if (error.code === "23505") toast.error("Este usuário já possui essa role");
      else toast.error("Erro ao adicionar funcionário. Verifique as permissões.");
      return;
    }
    toast.success("Funcionário adicionado com sucesso!");
    await logAdminAction("add_employee", "user_roles", foundUser.user_id, { email: foundUser.email });
    setShowAddDialog(false);
    setSearchEmail("");
    setFoundUser(null);
    loadEmployees();
  };

  const removeEmployee = async (userId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "employee" as any);
    if (error) { toast.error("Erro ao remover funcionário"); return; }
    toast.success("Funcionário removido!");
    await logAdminAction("remove_employee", "user_roles", userId);
    loadEmployees();
  };

  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Funcionários</h2>
          <p className="text-sm mt-1 text-white/40">Gerencie os funcionários com acesso limitado ao painel</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}
          className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 gap-2">
          <Plus className="h-4 w-4" /> Adicionar Funcionário
        </Button>
      </div>

      {/* Info card */}
      <AdminPanel>
        <div className="flex items-start gap-4 p-1 text-white/60">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-indigo-500/10">
            <Shield className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">Permissões de Funcionário</h3>
            <p className="text-[13px] mt-1">
              Funcionários podem: <strong className="text-white/80">visualizar produtos, vendedores e transações</strong>, e <strong className="text-white/80">aprovar/bloquear contas de sellers</strong>.
            </p>
            <p className="text-[13px] mt-1">
              Funcionários <strong className="text-white/80">NÃO</strong> podem: ver lucro/faturamento geral, gerenciar saques, editar configurações da plataforma, acessar disputas ou auditoria.
            </p>
          </div>
        </div>
      </AdminPanel>

      {/* Employee list */}
      <AdminPanel>
        <PanelTitle color="indigo" icon={<UserCog className="h-4 w-4" />}>Lista de Funcionários</PanelTitle>
        <div className="mt-4">
          {loading ? (
            <div className="text-center py-12 text-sm text-white/20">Carregando...</div>
          ) : employees.length === 0 ? (
            <div className="text-center py-16 text-white/20">
              <UserCog className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum funcionário cadastrado</p>
              <p className="text-xs mt-1">Clique em "Adicionar Funcionário" para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {["Nome", "E-mail", "Status da Conta", "Desde", "Ações"].map(h => (
                      <th key={h} className="text-left p-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const profile = getProfile(emp.user_id);
                    return (
                      <tr key={emp.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold bg-indigo-500/10 text-indigo-400">
                              {(profile?.full_name || "?")[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-white">{profile?.full_name || "—"}</span>
                          </div>
                        </td>
                        <td className="p-3 text-[13px] text-white/50">{profile?.email || "—"}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            profile?.account_status === "approved"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {profile?.account_status === "approved" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {profile?.account_status || "pending"}
                          </span>
                        </td>
                        <td className="p-3 text-[12px] text-white/30">
                          {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—"}
                        </td>
                        <td className="p-3">
                          <Button size="sm" variant="ghost" onClick={() => removeEmployee(emp.user_id)}
                            className="text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl gap-1.5 text-[11px]">
                            <Trash2 className="h-3.5 w-3.5" /> Remover
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminPanel>

      {/* Add Employee Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#0A0A10] border-white/[0.06] text-white rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Adicionar Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-[11px] uppercase tracking-wider font-semibold text-white/40">E-mail do usuário</Label>
              <div className="flex gap-2 mt-2">
                <Input value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="usuario@email.com"
                  className="flex-1 h-11 rounded-xl bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20"
                  onKeyDown={e => e.key === "Enter" && searchUser()} />
                <Button onClick={searchUser} disabled={searching} className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {foundUser && (
              <div className="rounded-xl p-4 border bg-white/[0.02] border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold bg-indigo-500/10 text-indigo-400">
                    {(foundUser.full_name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">{foundUser.full_name || "Sem nome"}</p>
                    <p className="text-xs text-white/40">{foundUser.email}</p>
                  </div>
                </div>
                <Button onClick={addEmployee} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 gap-2">
                  <UserCog className="h-4 w-4" /> Confirmar como Funcionário
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
