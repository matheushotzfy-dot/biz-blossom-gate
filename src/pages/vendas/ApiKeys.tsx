/**
 * Credenciais de API: chaves para o sistema do vendedor falar com a Vemprapay.
 * A chave secreta nasce na edge function `generate-api-key` e só aparece uma vez; o banco guarda o hash.
 * Pausar é reversível. Revogar é permanente (o banco recusa reativar) e exige confirmação.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, BookOpenText, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/Seo";
import { PageHead } from "@/components/seller-ui/PageHead";
import { StatBand } from "@/components/seller-ui/StatBand";
import { SearchField } from "@/components/seller-ui/SearchField";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { copyText } from "@/components/seller-ui/copy";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { KeyNameDialog, SecretDialog, type KeyNameTarget, type RevealedKey, type SaveResult } from "@/components/integrations/KeyDialogs";
import { KeysLedger } from "@/components/integrations/KeysLedger";
import { MAX_API_KEYS, ago, daysUntil, functionErrorMessage, keyState, type ApiKeyRow } from "@/components/integrations/intMeta";

const COLUMNS = "id, name, public_key, secret_key_prefix, is_active, created_at, last_used_at, expires_at, revoked_at";

type Confirm = { kind: "revoke" | "delete"; key: ApiKeyRow } | null;

export default function ApiKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [nameTarget, setNameTarget] = useState<{ target: KeyNameTarget; id?: string } | null>(null);
  const [revealed, setRevealed] = useState<RevealedKey | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from("api_keys").select(COLUMNS).eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) { setLoadError(true); } else { setKeys((data ?? []) as ApiKeyRow[]); setLoadError(false); }
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const live = keys.filter((k) => keyState(k) === "active");
    const used = keys.map((k) => k.last_used_at).filter((v): v is string => !!v).sort().pop() ?? null;
    const soon = live.filter((k) => k.expires_at && daysUntil(k.expires_at) <= 14).length;
    return { live: live.length, used, soon };
  }, [keys]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? keys.filter((k) => k.name.toLowerCase().includes(term) || k.public_key.toLowerCase().includes(term)) : keys;
  }, [keys, q]);

  const full = keys.length >= MAX_API_KEYS;

  const saveName = async (name: string): Promise<SaveResult> => {
    const editing = nameTarget?.id;
    const { data, error } = await supabase.functions.invoke("generate-api-key", { body: editing ? { action: "rename", keyId: editing, name } : { action: "create", name } });
    if (error || !data?.success) return { ok: false, message: await functionErrorMessage(error, editing ? "Não foi possível renomear a chave." : "Não foi possível criar a chave.") };
    setNameTarget(null);
    if (editing) { toast.success("Nome atualizado."); }
    else { setRevealed({ name: data.data.name, public_key: data.data.public_key, secret_key: data.data.secret_key }); }
    await load();
    return { ok: true };
  };

  const toggle = async (k: ApiKeyRow) => {
    if (!user || busyId) return;
    const next = !k.is_active;
    setBusyId(k.id);
    const { error } = await supabase.from("api_keys").update({ is_active: next }).eq("id", k.id).eq("user_id", user.id);
    setBusyId(null);
    if (error) { toast.error(next ? "Não foi possível reativar a chave." : "Não foi possível pausar a chave."); return; }
    toast.success(next ? "Chave reativada." : "Chave pausada. Ela não autentica enquanto estiver assim.");
    await load();
  };

  const copyPublic = (k: ApiKeyRow) => { void copyText(k.public_key, "Chave pública copiada."); };

  const runConfirm = async () => {
    if (!confirm || !user) return;
    const { kind, key } = confirm;
    setConfirmBusy(true);
    if (kind === "revoke") {
      const { error } = await supabase.from("api_keys").update({ is_active: false, revoked_at: new Date().toISOString() }).eq("id", key.id).eq("user_id", user.id);
      setConfirmBusy(false);
      if (error) { toast.error("Não foi possível revogar a chave. Tente de novo."); return; }
      toast.success("Chave revogada.");
    } else {
      const { error } = await supabase.functions.invoke("generate-api-key", { body: { action: "delete", keyId: key.id } });
      setConfirmBusy(false);
      if (error) { toast.error(await functionErrorMessage(error, "Não foi possível excluir a chave.")); return; }
      toast.success("Chave excluída.");
    }
    setConfirm(null);
    await load();
  };

  const newKey = () => {
    if (full) { toast.error(`Você já tem ${MAX_API_KEYS} chaves. Exclua uma para criar outra.`); return; }
    setNameTarget({ target: { mode: "create" } });
  };

  const empty = !loading && !loadError && keys.length === 0;

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Credenciais de API | Vemprapay" description="Crie e gerencie as chaves que conectam o seu sistema à Vemprapay." path="/integracoes?tab=keys" noindex />

      <PageHead
        title="Credenciais de API"
        subtitle="Chaves para o seu sistema falar com a Vemprapay. A chave secreta aparece uma única vez, na hora de criar."
        actions={
          <>
            <Link to="/integracoes?tab=api" className="vp-ghost"><BookOpenText className="h-[18px] w-[18px]" />Documentação</Link>
            <button type="button" className="vp-cta" onClick={newKey}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Nova chave</button>
          </>
        }
      />

      <StatBand
        label="Resumo das chaves"
        cells={[
          { label: "Chaves ativas", featured: true, loading, value: String(stats.live), sub: stats.live === 0 ? "Nenhuma autenticando agora" : "Autenticando requisições" },
          { label: "Último uso", loading, value: stats.used ? ago(stats.used) : "Nunca", sub: stats.used ? "Em qualquer chave" : "Nenhuma requisição ainda" },
          { label: "Perto de expirar", loading, value: String(stats.soon), sub: stats.soon > 0 ? "Vencem em até 14 dias" : "Nada vencendo em breve" },
          { label: "Espaço", loading, value: `${keys.length} de ${MAX_API_KEYS}`, sub: full ? "Exclua uma chave para criar outra" : "Chaves criadas" },
        ]}
      />

      <p role="note" className="rounded-[16px] bg-muted px-4 py-3 text-[13.5px] font-medium leading-snug text-foreground/80">
        A API pública de cobranças ainda não está aberta para uso. Você já pode criar e guardar suas chaves: elas passam a valer assim que a API for liberada.
      </p>

      {loadError ? (
        <section className="vp-sheet">
          <EmptyPanel icon={<AlertCircle className="h-7 w-7" strokeWidth={1.8} />} title="Não foi possível carregar as chaves" text="Confira sua conexão e tente de novo. Suas chaves continuam salvas." action={<button type="button" className="vp-ghost" onClick={() => { setLoading(true); void load(); }}>Tentar de novo</button>} />
        </section>
      ) : loading ? (
        <div className="space-y-3" aria-busy="true">{Array.from({ length: 3 }, (_, i) => <div key={i} className="vp-skel h-[84px] !rounded-[22px]" />)}</div>
      ) : empty ? (
        <section className="vp-sheet">
          <EmptyPanel
            icon={<KeyRound className="h-7 w-7" strokeWidth={1.8} />}
            title="Crie sua primeira chave"
            text="Use uma chave por sistema ou ambiente. Se uma vazar, você revoga só ela e o resto continua funcionando."
            action={<button type="button" className="vp-cta" onClick={newKey}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Nova chave</button>}
          />
        </section>
      ) : (
        <>
          {keys.length > 3 && <SearchField label="Buscar chave" value={q} onChange={setQ} placeholder="Nome ou chave pública" className="sm:w-[320px]" />}
          {shown.length === 0 ? (
            <section className="vp-sheet">
              <EmptyPanel title="Nenhuma chave encontrada" text="Tente outro nome." action={<button type="button" className="vp-ghost" onClick={() => setQ("")}>Limpar busca</button>} />
            </section>
          ) : (
            <KeysLedger
              keys={shown} busyId={busyId}
              onCopy={copyPublic}
              onRename={(k) => setNameTarget({ target: { mode: "rename", name: k.name }, id: k.id })}
              onToggle={(k) => void toggle(k)}
              onRevoke={(k) => setConfirm({ kind: "revoke", key: k })}
              onDelete={(k) => setConfirm({ kind: "delete", key: k })}
            />
          )}
        </>
      )}

      <KeyNameDialog target={nameTarget?.target ?? null} onOpenChange={(o) => { if (!o) setNameTarget(null); }} onSave={saveName} />
      <SecretDialog value={revealed} onClose={() => setRevealed(null)} />

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o && !confirmBusy) setConfirm(null); }}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "revoke" ? `Revogar "${confirm.key.name}"?` : `Excluir "${confirm?.key.name}"?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "revoke"
                ? "A chave para de funcionar na hora e não pode ser reativada. Quem usa essa chave vai receber erro de autenticação. A chave continua na lista como revogada."
                : confirm && keyState(confirm.key) === "active"
                  ? "A chave deixa de funcionar e some da lista. Quem usa essa chave vai receber erro de autenticação. Isso não pode ser desfeito."
                  : "A chave some da lista. Isso não pode ser desfeito."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="vp-cta vp-cta-danger" disabled={confirmBusy} onClick={(e) => { e.preventDefault(); void runConfirm(); }}>
              {confirmBusy ? "Aguarde…" : confirm?.kind === "revoke" ? "Revogar chave" : "Excluir chave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
