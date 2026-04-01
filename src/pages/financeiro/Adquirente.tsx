import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Landmark, CheckCircle2, TrendingUp, Loader2, AlertCircle } from "lucide-react";
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
    const [acqRes, profileRes] = await Promise.all([
      supabase.from("acquirers").select("id, name, slug, type, description, conversion_rate").order("conversion_rate", { ascending: false }),
      supabase.from("profiles").select("acquirer_id").eq("user_id", user!.id).maybeSingle(),
    ]);
    if (acqRes.data) setAcquirers(acqRes.data as unknown as VisibleAcquirer[]);
    if (profileRes.data?.acquirer_id) setCurrentAcquirerId(profileRes.data.acquirer_id);
    setLoading(false);
  };

  const selectAcquirer = async (acquirerId: string) => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ acquirer_id: acquirerId }).eq("user_id", user.id);
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

  const selectedAcq = acquirers.find(a => a.id === currentAcquirerId);

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-display font-black text-foreground flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 border border-primary/15">
            <Landmark className="h-5 w-5 text-primary" />
          </div>
          Escolher Adquirente
        </h1>
        <p className="text-[13px] text-muted-foreground mt-2 ml-[52px]">
          Selecione a adquirente para processar seus pagamentos. A taxa de conversão mostra a performance de aprovação.
        </p>
      </div>

      {/* Current selection card */}
      {selectedAcq && (
        <Card className="border-primary/20 bg-primary/[0.04]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Adquirente Atual</p>
              <p className="text-sm font-black text-foreground mt-0.5">{selectedAcq.name}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-primary font-numbers">{selectedAcq.conversion_rate}%</p>
              <p className="text-[10px] text-muted-foreground">conversão</p>
            </div>
          </CardContent>
        </Card>
      )}

      {acquirers.length === 0 ? (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-16 text-center">
            <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
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
                className={`border transition-all duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer hover:scale-[1.01] active:scale-[0.985] ${
                  isSelected
                    ? "border-primary/30 bg-primary/[0.04] ring-2 ring-primary/15 shadow-lg"
                    : "border-border/40 bg-card/60 hover:border-border hover:shadow-md"
                }`}
                onClick={() => !saving && selectAcquirer(acq.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-base font-black border ${
                        acq.type === "black"
                          ? "bg-muted text-foreground border-border"
                          : "bg-secondary text-secondary-foreground border-border"
                      }`}>
                        {acq.name[0]}
                      </div>
                      <div>
                        <CardTitle className="text-[14px] font-black">{acq.name}</CardTitle>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          acq.type === "black"
                            ? "bg-muted text-muted-foreground border border-border"
                            : "bg-secondary text-secondary-foreground border border-border"
                        }`}>{acq.type}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-black">Ativa</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {acq.description && (
                    <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed">{acq.description}</p>
                  )}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/10 border border-border/30">
                    <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground font-semibold">Taxa de Conversão</p>
                    </div>
                    <p className="text-[16px] font-black text-foreground font-numbers">{acq.conversion_rate}%</p>
                  </div>
                  {!isSelected && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-3 text-xs rounded-xl h-9 font-bold"
                      disabled={saving}
                      onClick={(e) => { e.stopPropagation(); selectAcquirer(acq.id); }}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                      Selecionar
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
