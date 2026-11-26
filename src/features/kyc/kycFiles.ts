/**
 * Arquivos da verificação de identidade (bucket privado `kyc-documents`, pasta `<userId>/`).
 * Um lugar só para preparar, nomear, enviar e explicar erros, usado pela aba Identidade e pelo popup de boas-vindas.
 *
 * Regras que o servidor também aplica (migration 20261126020000_kyc_documentos_analise.sql):
 * - nome `<tipo>_<token>.<ext>` com tipo front|back|selfie|cnpj_card e ext jpg|png|webp|pdf;
 * - JPG, PNG, WebP ou PDF de até 10 MB (PDF só para documento e cartão CNPJ: a selfie é sempre foto);
 * - só enquanto a conta está pendente ou reprovada.
 */
import { supabase } from "@/integrations/supabase/client";
import type { KycDocType } from "@/components/kyc/kycSteps";
import { DOC_EXT, kycSubmitError, staleNames } from "@/components/account/accountMeta";

export { kycSubmitError };

export const KYC_BUCKET = "kyc-documents";
export const MAX_KYC_BYTES = 10 * 1024 * 1024;
/** Abaixo disso a foto não dá para ler (número, nome, rosto). */
export const MIN_LONG_EDGE = 640;
/** Foto maior que isso é reduzida antes do envio (o documento continua legível e o envio fica leve). */
export const MAX_LONG_EDGE = 3200;
/** Acima disso a foto também é recomprimida, mesmo que o tamanho em pixels esteja bom. */
const RECOMPRESS_BYTES = 6 * 1024 * 1024;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const acceptsPdf = (type: KycDocType) => type !== "selfie";

/** Valor do `accept` do campo de arquivo para cada documento. */
export const kycAccept = (type: KycDocType) =>
  acceptsPdf(type) ? "image/jpeg,image/png,image/webp,application/pdf,.heic,.heif" : "image/jpeg,image/png,image/webp,.heic,.heif";

export const isPdfName = (name: string) => /\.pdf$/i.test(name);

/** Nome do objeto no bucket. O token evita cache velho e deixa o arquivo novo conviver com o antigo até o antigo sair. */
export function kycObjectName(type: KycDocType, mime: string, token = randomToken()): string {
  return `${type}_${token}.${DOC_EXT[mime] ?? "jpg"}`;
}

function randomToken(): string {
  const raw = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return raw.replace(/[^a-f0-9]/gi, "").slice(0, 10);
}

/* ───────────────────────── preparação do arquivo ───────────────────────── */

export interface Decoded { width: number; height: number; draw: (canvas: HTMLCanvasElement, width: number, height: number) => void; close: () => void }
export interface PrepareDeps {
  decode: (file: Blob) => Promise<Decoded>;
  encode: (canvas: HTMLCanvasElement, quality: number) => Promise<Blob | null>;
  readHead: (file: Blob, bytes: number) => Promise<Uint8Array>;
}

export interface Prepared { file: File | null; error: string | null; changed: boolean }

const looksHeic = (f: File) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

const ok = (file: File, changed = false): Prepared => ({ file, error: null, changed });
const fail = (error: string): Prepared => ({ file: null, error, changed: false });

/**
 * Deixa o arquivo pronto para o envio: confere tipo e tamanho, recusa foto ilegível de tão pequena e reduz/converte
 * foto grande, HEIC ou em formato que o painel não aceita (quando o navegador consegue abrir). A conversão para JPEG
 * também tira os metadados da câmera, como a localização.
 */
export async function prepareKycFile(file: File, type: KycDocType, deps: PrepareDeps = browserDeps): Promise<Prepared> {
  if (!file || file.size === 0) return fail("O arquivo está vazio. Escolha a foto de novo.");

  const pdf = file.type === "application/pdf" || isPdfName(file.name);
  if (pdf) {
    if (!acceptsPdf(type)) return fail("A selfie precisa ser uma foto (JPG, PNG ou WebP), não PDF.");
    if (file.size > MAX_KYC_BYTES) return fail("O PDF passa de 10 MB. Gere o arquivo de novo ou envie uma foto do documento.");
    const head = await deps.readHead(file, 5).catch(() => new Uint8Array());
    if (String.fromCharCode(...head) !== "%PDF-") return fail("Esse arquivo não é um PDF válido. Envie o PDF original ou uma foto do documento.");
    return ok(file.type === "application/pdf" ? file : new File([file], file.name, { type: "application/pdf" }));
  }

  if (!file.type.startsWith("image/") && !looksHeic(file)) {
    return fail(acceptsPdf(type) ? "Formato não aceito. Envie uma foto (JPG, PNG ou WebP) ou um PDF." : "Formato não aceito. Envie uma foto em JPG, PNG ou WebP.");
  }

  let image: Decoded;
  try {
    image = await deps.decode(file);
  } catch {
    return fail(looksHeic(file)
      ? "Este navegador não abre fotos HEIC do iPhone. Envie pelo celular (o iPhone converte sozinho) ou salve a foto como JPG."
      : "Não conseguimos abrir essa imagem. Tire a foto de novo ou envie em JPG ou PNG.");
  }

  try {
    const long = Math.max(image.width, image.height);
    if (long < MIN_LONG_EDGE) {
      return fail(`A foto está pequena demais (${image.width} × ${image.height}) para ler o documento. Tire de mais perto, com boa luz.`);
    }
    const known = (IMAGE_TYPES as readonly string[]).includes(file.type);
    const needs = !known || long > MAX_LONG_EDGE || file.size > RECOMPRESS_BYTES;
    if (!needs) return ok(file);

    const scale = Math.min(1, MAX_LONG_EDGE / long);
    const w = Math.max(1, Math.round(image.width * scale));
    const h = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    image.draw(canvas, w, h);
    for (const quality of [0.9, 0.82, 0.72]) {
      const blob = await deps.encode(canvas, quality);
      if (blob && blob.size <= MAX_KYC_BYTES) {
        const name = file.name.replace(/\.[a-z0-9]+$/i, "") || type;
        return ok(new File([blob], `${name}.jpg`, { type: "image/jpeg" }), true);
      }
    }
    return fail("Não conseguimos reduzir essa foto para até 10 MB. Tire outra foto ou envie uma imagem menor.");
  } finally {
    image.close();
  }
}

const browserDeps: PrepareDeps = {
  async decode(file) {
    if (typeof createImageBitmap === "function") {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return {
        width: bmp.width, height: bmp.height,
        draw: (canvas, w, h) => canvas.getContext("2d")?.drawImage(bmp, 0, 0, w, h),
        close: () => bmp.close(),
      };
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return {
        width: img.naturalWidth, height: img.naturalHeight,
        draw: (canvas, w, h) => canvas.getContext("2d")?.drawImage(img, 0, 0, w, h),
        close: () => URL.revokeObjectURL(url),
      };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  },
  encode: (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality)),
  async readHead(file, bytes) {
    return new Uint8Array(await file.slice(0, bytes).arrayBuffer());
  },
};

/* ───────────────────────── envio ───────────────────────── */

export interface UploadResult { ok: boolean; name: string | null; error: string | null }

/** Sobe o arquivo novo e só então apaga os antigos do mesmo tipo: a conta nunca fica sem o documento. */
export async function uploadKycDoc(userId: string, type: KycDocType, file: File): Promise<UploadResult> {
  const name = kycObjectName(type, file.type);
  const up = await supabase.storage.from(KYC_BUCKET).upload(`${userId}/${name}`, file, { contentType: file.type, upsert: false });
  if (up.error) return { ok: false, name: null, error: uploadError(up.error) };
  try {
    const { data: now } = await supabase.storage.from(KYC_BUCKET).list(userId, { limit: 100 });
    const old = staleNames(now ?? [], type, name).map((n) => `${userId}/${n}`);
    if (old.length) await supabase.storage.from(KYC_BUCKET).remove(old);
  } catch { /* o novo já subiu; o antigo sai na próxima troca */ }
  return { ok: true, name, error: null };
}

export function uploadError(err: unknown): string {
  const raw = `${(err as { message?: string } | null)?.message ?? ""} ${(err as { statusCode?: string | number } | null)?.statusCode ?? ""}`;
  if (/row-level security|unauthorized|403|policy/i.test(raw)) {
    return "Os documentos não podem ser trocados agora (a verificação já foi enviada ou concluída). Atualize a página.";
  }
  if (/mime|content type|invalid_mime/i.test(raw)) return "Formato não aceito. Envie JPG, PNG, WebP ou PDF.";
  if (/payload too large|413|maximum allowed size|exceeded/i.test(raw)) return "O arquivo passa de 10 MB. Envie uma foto menor.";
  if (/fetch|network|timeout/i.test(raw)) return "Não foi possível enviar. Confira a conexão e tente de novo.";
  return "Não foi possível enviar. Tente de novo em instantes.";
}

/* ───────────────────────── envio para análise ───────────────────────── */

export async function submitKyc(): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc("mark_kyc_submitted");
  return error ? { ok: false, error: kycSubmitError(error) } : { ok: true, error: null };
}
