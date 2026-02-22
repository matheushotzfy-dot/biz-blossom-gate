import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Search, Shield, Ban, CheckCircle2, Eye, MoreHorizontal } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tables } from "@/integrations/supabase/types";

export default function AdminUsuarios() {
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [search, setSearch] = useState("");

  const loadProfiles = () => {
    supabase.from("profiles").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setProfiles(data); });
  };

  useEffect(() => { loadProfiles(); }, []);

  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.full_name?.toLowerCase().includes(s)) || (p.email?.toLowerCase().includes(s)) || (p.document_number?.includes(s));
  });

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
          <p className="text-2xl font-bold mt-1 text-info">{profiles.filter((p) => p.phone).length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Hoje</p>
          <p className="text-2xl font-bold mt-1 text-warning">
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
                        <DropdownMenuItem className="gap-2">
                          <Eye className="h-3.5 w-3.5" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-primary">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar conta
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-destructive">
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
    </div>
  );
}
