import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Landmark, CheckCircle2, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VisibleAcquirer {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  conversion_rate: number;
}

export default function Adquirente() {
  const { user } = useAuth();
  const [acquirers, setAcquirers] = useState<VisibleAcquirer[]>([]);
  const [currentAcquirerId, setCurrentAcquirerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    // Load visible acquirers (RLS filters to seller_visible=true & is_active=true)
    const { data: acqs } = await supabase
      .from("acquirers")
      .select("id, name, slug, type, description, conversion_rate")
      .order("conversion_rate", { ascending: false });

    if (acqs) setAcquirers(acqs as unknown as VisibleAcquirer[]);

    // Load current profile acquirer
    const { data: profile } = await supabase
      .from("profiles")
      .select("acquirer_id")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (profile?.acquirer_id) setCurrentAcquirerId(profile.acquirer_id);
    setLoading(false);
  };

  const selectAcquirer = async (acquirerId: string) => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ acquirer_id: acquirerId })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao selecionar adquirente");
    } else {
      setCurrentAcquirerId(acquirerId);
      toast.success("Adquirente selecionada com sucesso!");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-black text-foreground flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          Escolher Adquirente
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione a adquirente de pagamento para processar suas vendas. A taxa de conversão indica a performance de cada uma.
        </p>
      </div>

      {acquirers.length === 0 ? (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-12 text-center">
            <Landmark className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">Nenhuma adquirente disponível</p>
            <p className="text-xs text-muted-foreground/60 mt-1">O administrador ainda não liberou adquirentes para seleção.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {acquirers.map(acq => {
            const isSelected = currentAcquirerId === acq.id;
            return (
              <Card
                key={acq.id}
                className={`border transition-all cursor-pointer hover:scale-[1.01] ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/40 bg-card/60 hover:border-border"
                }`}
                onClick={() => !saving && selectAcquirer(acq.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-base font-black ${
                        acq.type === "black"
                          ? "bg-muted text-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}>
                        {acq.name[0]}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold">{acq.name}</CardTitle>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          acq.type === "black"
                            ? "bg-muted text-muted-foreground border border-border"
                            : "bg-secondary text-secondary-foreground border border-border"
                        }`}>{acq.type}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-[11px] font-bold">Selecionada</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {acq.description && (
                    <p className="text-[12px] text-muted-foreground mb-3">{acq.description}</p>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/15 border border-border/40">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-[13px] font-black text-foreground">{acq.conversion_rate}%</p>
                      <p className="text-[9px] text-muted-foreground">Taxa de conversão</p>
                    </div>
                  </div>
                  {!isSelected && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-3 text-xs rounded-xl"
                      disabled={saving}
                      onClick={(e) => { e.stopPropagation(); selectAcquirer(acq.id); }}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Selecionar esta adquirente
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
