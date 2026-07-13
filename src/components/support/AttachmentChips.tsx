/**
 * Renders a message's attachments as clickable chips.
 * Fetches short-lived signed URLs on demand.
 */
import { useState } from "react";
import { Paperclip, Download, ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSignedUrl, humanSize, type Attachment } from "@/lib/ticketAttachments";

export function AttachmentChips({
  attachments,
  tone = "muted",
}: {
  attachments: Attachment[] | null | undefined;
  tone?: "muted" | "primary" | "emerald";
}) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!attachments || attachments.length === 0) return null;

  const open = async (a: Attachment) => {
    setBusy(a.path);
    const url = await getSignedUrl(a.path);
    setBusy(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const toneClasses =
    tone === "primary"
      ? "bg-primary-foreground/10 border-primary-foreground/25 text-primary-foreground hover:bg-primary-foreground/20"
      : tone === "emerald"
      ? "bg-emerald-500/10 border-emerald-500/30 text-foreground hover:bg-emerald-500/20"
      : "bg-muted/40 border-border/60 text-foreground hover:bg-muted/60";

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {attachments.map(a => {
        const isImg = a.type?.startsWith("image/");
        const Icon = isImg ? ImageIcon : /pdf/i.test(a.type) || /\.pdf$/i.test(a.name) ? FileText : Paperclip;
        return (
          <button
            key={a.path}
            onClick={() => open(a)}
            disabled={busy === a.path}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors max-w-[220px]",
              toneClasses,
              busy === a.path && "opacity-60",
            )}
            title={a.name}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{a.name}</span>
            <span className="opacity-60 tabular-nums">{humanSize(a.size)}</span>
            <Download className="h-3 w-3 shrink-0 opacity-70" />
          </button>
        );
      })}
    </div>
  );
}
