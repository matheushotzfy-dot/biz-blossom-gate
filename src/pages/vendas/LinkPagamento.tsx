import { useState } from "react";
import { Link2, Copy, ExternalLink, Plus, QrCode, TrendingUp, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type PayLink = {
  id: string;
  name: string;
  product_name: string;
  slug: string;
  amount: number;
  clicks: number;
  conversions: number;
  revenue: number;
  is_active: boolean;
};

const MOCK: PayLink[] = [
  { id: "1", name: "Link VIP Black Friday", product_name: "Curso Pro", slug: "bf-vip", amount: 197, clicks: 1240, conversions: 186, revenue: 36642, is_active: true },
  { id: "2", name: "Promoção Relâmpago", product_name: "E-book Master", slug: "promo-flash", amount: 47, clicks: 890, conversions: 267, revenue: 12549, is_active: true },
  { id: "3", name: "Mentoria Exclusiva", product_name: "Mentoria 1:1", slug: "mentoria-exc", amount: 997, clicks: 340, conversions: 34, revenue: 33898, is_active: false },
];

export default function LinkPagamento() {
  const [links, setLinks] = useState(MOCK);
  const [showNew, setShowNew] = useState(false);

  const totalRevenue = links.reduce((s, l) => s + l.revenue, 0);
  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const totalConversions = links.reduce((s, l) => s + l.conversions, 0);

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/pay/${slug}`);
    toast.success("Link copiado!");
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Receita Total", value: `R$ ${totalRevenue.toLocaleString("pt-BR")}`, icon: TrendingUp, color: "text-primary" },
          { label: "Cliques", value: totalClicks.toLocaleString("pt-BR"), icon: Eye, color: "text-blue-500" },
          { label: "Conversões", value: totalConversions.toLocaleString("pt-BR"), icon: Link2, color: "text-emerald-500" },
          { label: "Links Ativos", value: links.filter(l => l.is_active).length, icon: QrCode, color: "text-amber-500" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/40 bg-card/60 backdrop-blur-xl">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/50 ${kpi.color}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-black">{String(kpi.value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Links de Pagamento</h2>
        <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowNew(!showNew)}>
          <Plus className="h-4 w-4" /> Novo Link
        </Button>
      </div>

      {showNew && (
        <Card className="border-primary/20 bg-card/80 backdrop-blur-xl">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Input placeholder="Nome do link" className="rounded-xl" />
              <Select>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Curso Pro</SelectItem>
                  <SelectItem value="2">E-book Master</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Slug personalizado" className="rounded-xl" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNew(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={() => { setShowNew(false); toast.success("Link criado!"); }} className="rounded-xl">Criar Link</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {links.map(l => (
          <Card key={l.id} className="border-border/40 bg-card/60 backdrop-blur-xl transition-all hover:border-border/60">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{l.name}</h3>
                    <Badge variant={l.is_active ? "default" : "secondary"} className="text-[10px]">
                      {l.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {l.product_name} • R$ {l.amount} • {l.clicks} cliques → {l.conversions} vendas
                  </p>
                  <p className="mt-1 text-[11px] font-mono text-primary/80">/pay/{l.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Receita</p>
                  <p className="font-bold text-emerald-500">R$ {l.revenue.toLocaleString("pt-BR")}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => copyLink(l.slug)} className="rounded-xl">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => window.open(`/pay/${l.slug}`, "_blank")} className="rounded-xl">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
