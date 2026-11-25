import { useRef, useState } from "react";
import { Camera, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { StatusPill } from "@/components/seller-ui/tx";
import { initials } from "@/components/seller-ui/txMeta";
import { copyText } from "@/components/seller-ui/copy";
import { friendlyError } from "@/lib/friendlyError";
import {
  AVATAR_TYPES, MAX_AVATAR_RAW, avatarPath, documentLabel, formatDay, kycInfo, memberFor, sellerTypeLabel, validateAvatarFile, versionedUrl,
} from "./accountMeta";
import { squareAvatarBlob } from "./avatarImage";
import { useSalesCounts } from "./useAccountData";
import { Chip, Fact } from "./parts";

const AVATAR_BUCKET = "product-images";
const AVATAR_FILES = ["jpg", "png", "webp"];

export function IdentityCard() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const sales = useSalesCounts(user?.id);
  const input = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const name = profile?.full_name?.trim() || "Sem nome";
  const status = kycInfo(profile?.account_status);
  const hasPhoto = !!profile?.avatar_url;

  const pick = () => { setProblem(null); input.current?.click(); };

  const change = async (file: File) => {
    if (!user?.id || busyRef.current) return;
    const bad = validateAvatarFile(file);
    if (bad) { setProblem(bad); return; }
    busyRef.current = true; setBusy("save"); setProblem(null);
    try {
      let body: Blob = file;
      let mime: string = file.type;
      const square = await squareAvatarBlob(file);
      if (square) { body = square; mime = "image/jpeg"; }
      else if (file.size > MAX_AVATAR_RAW) throw new Error("Não conseguimos reduzir essa foto. Escolha uma menor que 4 MB.");
      const path = avatarPath(user.id, mime);
      const up = await supabase.storage.from(AVATAR_BUCKET).upload(path, body, { upsert: true, contentType: mime });
      if (up.error) throw up.error;
      const url = versionedUrl(supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl, Date.now());
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
      if (error) throw error;
      updateProfile({ avatar_url: url });
      toast.success("Foto atualizada");
      // Uma foto só por conta: apaga as de outro formato que sobraram (falha aqui não importa).
      const ext = path.split(".").pop();
      void supabase.storage.from(AVATAR_BUCKET).remove(AVATAR_FILES.filter((e) => e !== ext).map((e) => `${user.id}/avatar.${e}`));
    } catch (e) {
      setProblem(friendlyError(e, "Não foi possível enviar a foto. Tente de novo."));
    } finally {
      busyRef.current = false; setBusy(null);
    }
  };

  const remove = async () => {
    if (!user?.id || busyRef.current) return;
    busyRef.current = true; setBusy("remove"); setProblem(null);
    try {
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
      if (error) throw error;
      updateProfile({ avatar_url: null });
      toast.success("Foto removida");
      void supabase.storage.from(AVATAR_BUCKET).remove(AVATAR_FILES.map((e) => `${user.id}/avatar.${e}`));
    } catch (e) {
      setProblem(friendlyError(e, "Não foi possível remover a foto agora."));
    } finally {
      busyRef.current = false; setBusy(null);
    }
  };

  return (
    <section className="vp-sheet overflow-hidden" aria-label="Seu perfil">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-7 sm:p-7">
        <div className="va-avatar self-start sm:self-auto" aria-hidden={!hasPhoto}>
          {hasPhoto ? <img src={profile!.avatar_url!} alt="Sua foto de perfil" /> : <span className="grid h-full w-full place-items-center text-[34px] font-extrabold tracking-[-0.03em]" aria-hidden>{initials(name)}</span>}
          {busy === "save" && <span className="va-shot-veil" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Enviando a foto" /></span>}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-[26px] font-extrabold leading-tight tracking-[-0.035em] text-foreground sm:text-[30px]">{name}</h2>
          <p className="mt-0.5 truncate text-[15px] text-muted-foreground">{profile?.email || user?.email || "—"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill tone={status.tone} label={status.label} />
            <Chip>{sellerTypeLabel(profile?.seller_type, profile?.document_type)}</Chip>
            {profile?.nickname && <Chip>@{profile.nickname}</Chip>}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input ref={input} type="file" accept={AVATAR_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void change(f); }} />
            <button type="button" onClick={pick} disabled={busy !== null} className="vp-ghost h-10 px-4 text-[13.5px]">
              <Camera className="h-4 w-4" aria-hidden />{hasPhoto ? "Trocar foto" : "Adicionar foto"}
            </button>
            {hasPhoto && (
              <button type="button" onClick={() => void remove()} disabled={busy !== null} className="vp-ghost h-10 px-4 text-[13.5px] text-muted-foreground">
                {busy === "remove" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}Remover
              </button>
            )}
            <span className="text-[12.5px] text-muted-foreground">JPG, PNG ou WebP. A foto é recortada em quadrado.</span>
          </div>
          {problem && <p role="alert" className="mt-2.5 text-[13.5px] font-medium text-destructive">{problem}</p>}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-border lg:grid-cols-5 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1">
        <Fact label="Tipo de conta">{sellerTypeLabel(profile?.seller_type, profile?.document_type)}</Fact>
        <Fact label="Documento"><span className="block truncate">{documentLabel(profile)}</span></Fact>
        <Fact label="Na plataforma há" sub={`Desde ${formatDay(profile?.created_at)}`}>{memberFor(profile?.created_at)}</Fact>
        <Fact label="Vendas aprovadas" sub={sales.isError ? "Não foi possível carregar" : sales.data ? `${sales.data.last30.toLocaleString("pt-BR")} nos últimos 30 dias` : undefined}>
          {sales.isLoading ? <span className="vp-skel block h-5 w-12" /> : sales.isError ? "—" : <span className="vp-num">{(sales.data?.total ?? 0).toLocaleString("pt-BR")}</span>}
        </Fact>
        <Fact label="ID da conta">
          <span className="flex items-center gap-2">
            <span className="truncate font-mono text-[14px]" title={user?.id}>{user?.id ? `${user.id.slice(0, 8)}…` : "—"}</span>
            {user?.id && (
              <button type="button" onClick={() => void copyText(user.id, "ID da conta copiado")} className="vp-ghost h-8 w-8 shrink-0 !p-0" aria-label="Copiar o ID da conta" title="Copiar o ID da conta">
                <Copy className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </span>
        </Fact>
      </dl>
    </section>
  );
}
