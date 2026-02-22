import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";

export default function AdminUsuarios() {
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setProfiles(data); });
  }, []);

  return (
    <div className="space-y-6 dark">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Usuários
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Todos os usuários da plataforma</p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-4 font-medium">Nome</th>
              <th className="text-left p-4 font-medium">E-mail</th>
              <th className="text-left p-4 font-medium">Telefone</th>
              <th className="text-left p-4 font-medium">Documento</th>
              <th className="text-left p-4 font-medium">Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="p-4 font-semibold">{p.full_name || "—"}</td>
                <td className="p-4">{p.email || "—"}</td>
                <td className="p-4">{p.phone || "—"}</td>
                <td className="p-4 font-mono text-xs">{p.document_number || "—"}</td>
                <td className="p-4 text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
            {profiles.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum usuário registrado</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
