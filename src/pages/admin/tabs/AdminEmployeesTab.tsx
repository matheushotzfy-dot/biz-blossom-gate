import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  UserCog, Search, Plus, Trash2, Shield, CheckCircle2, XCircle,
  Mail, Calendar, Copy, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";
import { logAdminAction } from "@/lib/auditLog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
  const [filter, setFilter] = useState("");

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
      toast.error("Usuário não encontrado. Ele precisa estar cadastrado na plataforma.");
    }
    setSearching(false);
  };

  const addEmployee = async () => {
    if (!foundUser) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: foundUser.user_id, role: "employee" as any });
    if (error) {
      if (error.code === "23505") toast.error("Este usuário já possui essa role");
      else toast.error("Erro ao adicionar funcionário.");
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

  const filteredEmployees = employees.filter(emp => {
    if (!filter) return true;
    const p = getProfile(emp.user_id);
    return (p?.full_name || "").toLowerCase().includes(filter.toLowerCase()) ||
           (p?.email || "").toLowerCase().includes(filter.toLowerCase());
  });

  const permissions = [
    { label: "Visualizar produtos", allowed: true },
    { label: "Visualizar vendedores", allowed: true },
    { label: "Aprovar/bloquear contas", allowed: true },
    { label: "Visualizar transações", allowed: true },
    { label: "Ver lucro/faturamento", allowed: false },
    { label: "Gerenciar saques", allowed: false },
    { label: "Editar configurações", allowed: false },
    { label: "Acessar disputas", allowed: false },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <UserCog className="h-4.5 w-4.5 text-white" />
            </div>
            Staff / Funcionários
          </h2>
          <p className="text-[12px] text-muted-foreground mt-1 ml-[46px]">
            {employees.length} funcionário{employees.length !== 1 ? "s" : ""} com acesso ao painel
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}
          className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 gap-2 h-10 px-5">
          <Plus className="h-4 w-4" /> Adicionar Staff
        </Button>
      </div>

      {/* Permissions card */}
      <div className="rounded-2xl border border-indigo-500/10 bg-indigo-500/[0.03] p-5">
        <h3 className="text-[13px] font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-400" />
          Permissões do Staff
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {permissions.map(p => (
            <div key={p.label} className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium",
              p.allowed
                ? "bg-emerald-500/[0.06] text-emerald-400 border border-emerald-500/10"
                : "bg-red-500/[0.04] text-red-400/60 border border-red-500/8"
            )}>
              {p.allowed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {p.label}
            </div>
          ))}
        </div>
      </div>

      {/* Login info */}
      <div className="rounded-2xl border border-border bg-card/50 p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/15 flex items-center justify-center shrink-0">
            <Mail className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">Como o Staff faz login?</h3>
            <p className="text-[12px] text-muted-foreground mt-1">
              Funcionários usam a <strong className="text-foreground/80">mesma página de login do admin</strong> (<code className="bg-muted/40 px-1.5 py-0.5 rounded text-[11px]">/admin-matheus</code>).
              O sistema detecta automaticamente se é admin ou staff e libera as permissões corretas.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      {employees.length > 0 && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filtrar staff..."
            className="pl-9 h-10 rounded-xl bg-card border-border"
          />
        </div>
      )}

      {/* Staff list */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">Carregando...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <div className="h-16 w-16 rounded-2xl bg-indigo-500/5 flex items-center justify-center mx-auto mb-4">
              <UserCog className="h-8 w-8 opacity-20" />
            </div>
            <p className="text-[14px] font-medium">{employees.length === 0 ? "Nenhum funcionário cadastrado" : "Nenhum resultado"}</p>
            <p className="text-[12px] mt-1 text-muted-foreground/60">
              {employees.length === 0 ? "Adicione funcionários para dar acesso limitado ao painel" : "Tente outro filtro"}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredEmployees.map((emp, i) => {
              const profile = getProfile(emp.user_id);
              return (
                <motion.div
                  key={emp.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: i * 0.05 }}
                  className="group rounded-2xl border border-border bg-card hover:border-indigo-500/20 transition-all p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/15 flex items-center justify-center text-[14px] font-bold text-indigo-400">
                      {(profile?.full_name || profile?.email || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-foreground">{profile?.full_name || "Sem nome"}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[12px] text-muted-foreground">{profile?.email || "—"}</span>
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                          profile?.account_status === "approved"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/15"
                        )}>
                          {profile?.account_status === "approved" ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                          {profile?.account_status || "pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeEmployee(emp.user_id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl gap-1.5 text-[11px] h-9"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Add Employee Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md border-indigo-500/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Plus className="h-4 w-4 text-white" />
              </div>
              Adicionar Staff
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-3">
            <div className="rounded-xl bg-muted/20 border border-border p-3">
              <p className="text-[11px] text-muted-foreground">
                Digite o e-mail de um <strong className="text-foreground/70">usuário já cadastrado</strong> na plataforma para dar acesso de staff.
              </p>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-muted-foreground">E-mail do usuário</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={searchEmail}
                  onChange={e => setSearchEmail(e.target.value)}
                  placeholder="usuario@email.com"
                  className="flex-1 h-11 rounded-xl"
                  onKeyDown={e => e.key === "Enter" && searchUser()}
                />
                <Button onClick={searchUser} disabled={searching} className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {foundUser && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.03] p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 border border-indigo-500/20 flex items-center justify-center text-[16px] font-bold text-indigo-400">
                    {(foundUser.full_name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-[14px] text-foreground">{foundUser.full_name || "Sem nome"}</p>
                    <p className="text-[12px] text-muted-foreground">{foundUser.email}</p>
                  </div>
                </div>
                <Button onClick={addEmployee} className="w-full mt-4 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl h-11 gap-2 font-semibold shadow-lg shadow-indigo-500/20">
                  <UserCog className="h-4 w-4" /> Confirmar como Staff
                </Button>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
