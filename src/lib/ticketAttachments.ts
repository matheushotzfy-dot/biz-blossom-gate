/**
 * Helpers for ticket message attachments.
 * - Private bucket: `ticket-attachments`
 * - Path convention: `<ticket_id>/<uuid>-<sanitized-name>`
 * - Limits: 5 MB per file, up to 3 files per message
 */
import { supabase } from "@/integrations/supabase/client";

import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, MAX_FILES_PER_MESSAGE } from "@/lib/ticketLimits";

export { ACCEPTED_EXT, ACCEPTED_MIME, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, MAX_FILES_PER_MESSAGE } from "@/lib/ticketLimits";

export type Attachment = {
  path: string;
  name: string;
  size: number;
  type: string;
};

const sanitize = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);

export async function uploadTicketAttachments(
  ticketId: string,
  files: File[],
): Promise<Attachment[]> {
  if (!files.length) return [];
  if (files.length > MAX_FILES_PER_MESSAGE) {
    throw new Error(`Máximo de ${MAX_FILES_PER_MESSAGE} arquivos por mensagem.`);
  }
  const uploaded: Attachment[] = [];
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE_BYTES) {
      await discardAttachments(uploaded);
      throw new Error(`"${f.name}" excede ${MAX_FILE_SIZE_MB}MB.`);
    }
    const path = `${ticketId}/${crypto.randomUUID()}-${sanitize(f.name)}`;
    const { error } = await supabase.storage
      .from("ticket-attachments")
      .upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
    if (error) {
      // Não deixa arquivos soltos de uma mensagem que não chegou a ser enviada.
      await discardAttachments(uploaded);
      throw new Error(`Falha ao enviar "${f.name}".`);
    }
    uploaded.push({ path, name: f.name, size: f.size, type: f.type });
  }
  return uploaded;
}

/** Apaga anexos já enviados quando a mensagem não pôde ser salva. Nunca lança. */
export async function discardAttachments(list: Attachment[]): Promise<void> {
  if (!list.length) return;
  try {
    await supabase.storage.from("ticket-attachments").remove(list.map((a) => a.path));
  } catch {
    /* melhor esforço */
  }
}

export async function getSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("ticket-attachments")
    .createSignedUrl(path, 60 * 5);
  return data?.signedUrl ?? null;
}

/** Delete every stored file for a ticket. Called when a ticket is closed/resolved. */
export async function purgeTicketAttachments(ticketId: string): Promise<void> {
  const { data, error } = await supabase.storage
    .from("ticket-attachments")
    .list(ticketId, { limit: 1000 });
  if (error || !data?.length) return;
  const paths = data.map(o => `${ticketId}/${o.name}`);
  await supabase.storage.from("ticket-attachments").remove(paths);
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Soft beep for new incoming messages. No asset file needed. */
export function playIncomingBeep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.28);
    setTimeout(() => { void ctx.close().catch(() => undefined); }, 400);
  } catch { /* sem som: tudo bem */ }
}
