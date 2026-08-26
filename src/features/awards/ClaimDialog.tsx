import { useState } from "react";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AwardItem } from "./awards-data";
import type { RewardClaim } from "./use-awards";

interface ClaimDialogProps {
  open: boolean;
  userId?: string;
  award: AwardItem;
  onOpenChange: (open: boolean) => void;
  onCreated: (claim: RewardClaim) => void;
}

const initialForm = { recipient_name: "", phone: "", document: "", shipping_street: "", shipping_number: "", shipping_complement: "", shipping_neighborhood: "", shipping_city: "", shipping_state: "", shipping_zip: "" };

export function ClaimDialog({ open, userId, award, onOpenChange, onCreated }: ClaimDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!userId) return;
    const required: Array<keyof typeof form> = ["recipient_name", "phone", "shipping_street", "shipping_number", "shipping_neighborhood", "shipping_city", "shipping_state", "shipping_zip"];
    if (required.some((key) => !form[key].trim())) { toast.error("Preencha todos os campos obrigatórios"); return; }
    setSubmitting(true);
    const { data, error } = await supabase.from("reward_claims").insert({
      user_id: userId, tier_id: award.id, tier_label: award.title, tier_value: award.value,
      recipient_name: form.recipient_name.trim(), phone: form.phone.trim(), document: form.document.trim() || null,
      shipping_street: form.shipping_street.trim(), shipping_number: form.shipping_number.trim(), shipping_complement: form.shipping_complement.trim() || null,
      shipping_neighborhood: form.shipping_neighborhood.trim(), shipping_city: form.shipping_city.trim(), shipping_state: form.shipping_state.trim(), shipping_zip: form.shipping_zip.trim(),
    }).select("id, tier_id, tier_label, status, created_at").maybeSingle();
    setSubmitting(false);
    if (error || !data) { toast.error("Não foi possível registrar o resgate"); return; }
    onCreated(data as RewardClaim);
    onOpenChange(false);
    setForm(initialForm);
    toast.success("Solicitação registrada com sucesso");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-none border-border bg-card">
        <DialogHeader><DialogTitle className="flex items-center gap-2 font-display"><Gift className="text-primary" /> Solicitar {award.title}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Informe o endereço de entrega. A VENXPAY atualizará o rastreio dentro da plataforma.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input aria-label="Nome do recebedor" placeholder="Nome do recebedor *" value={form.recipient_name} onChange={(event) => update("recipient_name", event.target.value)} />
          <Input aria-label="Telefone" inputMode="tel" placeholder="Telefone com DDD *" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
          <Input aria-label="CPF ou CNPJ" inputMode="numeric" placeholder="CPF / CNPJ" value={form.document} onChange={(event) => update("document", event.target.value)} className="sm:col-span-2" />
          <Input aria-label="Rua" placeholder="Rua *" value={form.shipping_street} onChange={(event) => update("shipping_street", event.target.value)} className="sm:col-span-2" />
          <Input aria-label="Número" placeholder="Número *" value={form.shipping_number} onChange={(event) => update("shipping_number", event.target.value)} />
          <Input aria-label="Complemento" placeholder="Complemento" value={form.shipping_complement} onChange={(event) => update("shipping_complement", event.target.value)} />
          <Input aria-label="Bairro" placeholder="Bairro *" value={form.shipping_neighborhood} onChange={(event) => update("shipping_neighborhood", event.target.value)} className="sm:col-span-2" />
          <Input aria-label="Cidade" placeholder="Cidade *" value={form.shipping_city} onChange={(event) => update("shipping_city", event.target.value)} />
          <Input aria-label="Estado" placeholder="UF *" maxLength={2} value={form.shipping_state} onChange={(event) => update("shipping_state", event.target.value.toUpperCase())} />
          <Input aria-label="CEP" inputMode="numeric" placeholder="CEP *" value={form.shipping_zip} onChange={(event) => update("shipping_zip", event.target.value)} className="sm:col-span-2" />
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={submit} disabled={submitting}>{submitting ? "Registrando..." : "Confirmar entrega"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}