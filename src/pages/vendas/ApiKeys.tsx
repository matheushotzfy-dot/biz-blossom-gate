/**
 * Credenciais de API: chaves para o sistema do vendedor falar com a Vemprapay.
 * A chave secreta nasce na edge function `generate-api-key` e só aparece uma vez; o banco guarda o hash.
 * Pausar é reversível. Revogar é permanente (o banco recusa reativar) e exige confirmação.
 * Trocar cria uma chave nova com a antiga ainda valendo; só depois de o vendedor trocar no sistema dele é que revoga.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, BookOpenText, Hourglass, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/Seo";
import { PageHead } from "@/components/seller-ui/PageHead";
import { SearchField } from "@/components/seller-ui/SearchField";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { copyText } from "@/components/seller-ui/copy";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { KeyNameDialog, SecretDialog, type KeyNameTarget, type RevealedKey, type SaveResult } from "@/components/integrations/KeyDialogs";
import { KeyList } from "@/components/integrations/KeyList";
import { MAX_API_KEYS, functionErrorMessage, keyState, nextKeyName, type ApiKeyRow } from "@/components/integrations/intMeta";
import { cn } from "@/lib/utils";

const COLUMNS = "id, name, public_key, secret_key_prefix, is_active, created_at, last_used_at, expires_at, revoked_at";

type Confirm = { kind: "revoke" | "delete"; key: ApiKeyRow } | null;

export default function ApiKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [nameTarget, setNameTarget] = useState<{ target: KeyNameTarget; id?: string; replaces?: ApiKeyRow } | null>(null);
  const [swapId, setSwapId] = useState<string | null>(null);
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

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? keys.filter((k) => k.name.toLowerCase().includes(term) || k.public_key.toLowerCase().includes(term)) : keys;
  }, [keys, q]);

  const full = keys.length >= MAX_API_KEYS;

  const saveName = async (name: string): Promise<SaveResult> => {
    const editing = nameTarget?.id;
    const replaces = nameTarget?.replaces;
    const { data, error } = await supabase.functions.invoke("generate-api-key", { body: editing ? { action: "rename", keyId: editing, name } : { action: "create", name } });
    if (error || !data?.success) return { ok: false, message: await functionErrorMessage(error, editing ? "Não foi possível renomear a chave." : "Não foi possível criar a chave.") };
    setNameTarget(null);
    if (editing) { toast.success("Nome atualizado."); }
    else {
      setRevealed({ name: data.data.name, public_key: data.data.public_key, secret_key: data.data.secret_key, replaces: replaces?.name });
      if (replaces) setSwapId(replaces.id);
    }
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
    if (swapId === key.id) setSwapId(null);
    await load();
  };

  const noRoom = () => toast.error(`Você já tem ${MAX_API_KEYS} chaves. Chaves revogadas e expiradas também contam: exclua uma da lista para criar outra.`);

  const newKey = () => {
    if (full) { noRoom(); return; }
    setNameTarget({ target: { mode: "create" } });
  };

  const swapKey = (k: ApiKeyRow) => {
    if (full) { noRoom(); return; }
    setNameTarget({ target: { mode: "replace", name: nextKeyName(k.name, keys.map((x) => x.name)), from: k.name }, replaces: k });
  };

  const empty = !loading && !loadError && keys.length === 0;

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Credenciais de API | Vemprapay" description="Crie e gerencie as chaves que conectam o seu sistema à Vemprapay." path="/integracoes?tab=keys" noindex />

      <PageHead
        title="Credenciais de API"
        subtitle="As chaves que o seu sistema usa para falar com a Vemprapay."
        actions={
          <>
            <Link to="/integracoes?tab=api" className="vp-ghost"><BookOpenText className="h-[18px] w-[18px]" />Documentação</Link>
            <button type="button" className="vp-cta" onClick={newKey}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Nova chave</button>
          </>
        }
      />

      <aside className="flex items-start gap-4 rounded-[22px] bg-accent/60 px-5 py-4" aria-label="Situação da API">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-accent-foreground"><Hourglass className="h-[18px] w-[18px]" strokeWidth={2} /></span>
        <p className="min-w-0 text-[14px] leading-snug text-accent-foreground">
          <span className="font-bold">A API de cobranças ainda não está aberta.</span>{" "}
          Suas chaves ficam guardadas e passam a valer quando ela abrir.{" "}
          <Link to="/integracoes?tab=api" className="font-bold underline underline-offset-2 hover:no-underline">Ver como vai funcionar</Link>
        </p>
      </aside>

      {loadError ? (
        <section className="vp-sheet">
          <EmptyPanel icon={<AlertCircle className="h-7 w-7" strokeWidth={1.8} />} title="Não foi possível carregar as chaves" text="Confira sua conexão e tente de novo. Suas chaves continuam salvas." action={<button type="button" className="vp-ghost" onClick={() => { setLoading(true); void load(); }}>Tentar de novo</button>} />
        </section>
      ) : loading ? (
        <div className="space-y-3" aria-busy="true">{Array.from({ length: 2 }, (_, i) => <div key={i} className="vp-skel h-[150px] !rounded-[22px]" />)}</div>
      ) : empty ? (
        <section className="vp-sheet overflow-hidden">
          <div className="grid gap-8 px-6 py-10 sm:px-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-12 md:py-12">
            <div>
              <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground"><KeyRound className="h-6 w-6" strokeWidth={1.9} /></span>
              <h2 className="mt-5 font-heading text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">Cada chave vem em duas partes</h2>
              <p className="mt-2 max-w-[420px] text-[14.5px] leading-relaxed text-muted-foreground">Crie uma chave para cada sistema ou ambiente. Se uma vazar, você revoga só ela e o resto continua funcionando.</p>
              <button type="button" className="vp-cta mt-6" onClick={newKey}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Criar a primeira chave</button>
            </div>
            <dl className="space-y-3">
              <div className="rounded-[18px] bg-muted/70 px-5 py-4">
                <dt className="font-mono text-[13px] font-semibold text-foreground">pk_live_••••••••••••</dt>
                <dd className="mt-1.5 text-[13.5px] leading-snug text-muted-foreground"><span className="font-bold text-foreground">Pública.</span> Identifica a sua conta. Pode aparecer em telas e registros.</dd>
              </div>
              <div className="rounded-[18px] bg-[hsl(222_47%_8%)] px-5 py-4 text-white">
                <dt className="font-mono text-[13px] font-semibold">sk_live_••••••••••••••••••••</dt>
                <dd className="mt-1.5 text-[13.5px] leading-snug text-white/65"><span className="font-bold text-white">Secreta.</span> Autoriza as ações. Aparece inteira uma única vez, na hora de criar.</dd>
              </div>
            </dl>
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p className={cn("flex items-center gap-3 text-[13.5px] font-semibold", full ? "text-warning" : "text-muted-foreground")}>
              <span aria-hidden className="flex gap-1">
                {Array.from({ length: MAX_API_KEYS }, (_, i) => <i key={i} className={cn("block h-1.5 w-5 rounded-full", i < keys.length ? (full ? "bg-warning" : "bg-primary") : "bg-muted-foreground/20")} />)}
              </span>
              {keys.length} de {MAX_API_KEYS} chaves{full ? ". Exclua uma para criar outra." : ""}
            </p>
            {keys.length > 3 && <SearchField label="Buscar chave" value={q} onChange={setQ} placeholder="Nome ou chave pública" className="sm:w-[320px]" />}
          </div>
          {shown.length === 0 ? (
            <section className="vp-sheet">
              <EmptyPanel title="Nenhuma chave encontrada" text="Tente outro nome." action={<button type="button" className="vp-ghost" onClick={() => setQ("")}>Limpar busca</button>} />
            </section>
          ) : (
            <KeyList
              keys={shown} busyId={busyId} swapId={swapId}
              onCopy={copyPublic}
              onRename={(k) => setNameTarget({ target: { mode: "rename", name: k.name }, id: k.id })}
              onSwap={swapKey}
              onToggle={(k) => void toggle(k)}
              onRevoke={(k) => setConfirm({ kind: "revoke", key: k })}
              onDelete={(k) => setConfirm({ kind: "delete", key: k })}
              onDismissSwap={() => setSwapId(null)}
            />
          )}
        </>
      )}

      <KeyNameDialog target={nameTarget?.target ?? null} taken={keys.map((k) => k.name)} onOpenChange={(o) => { if (!o) setNameTarget(null); }} onSave={saveName} />
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
