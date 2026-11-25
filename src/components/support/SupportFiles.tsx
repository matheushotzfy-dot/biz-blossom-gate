import { FileText, ImageIcon, X } from 'lucide-react';
import { humanSize } from '@/lib/ticketAttachments';

export interface SupportFilesProps { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }

/** Arquivos escolhidos, ainda não enviados. */
export function SupportFiles({ files, onChange, disabled }: SupportFilesProps) {
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Arquivos para enviar">
      {files.map((file, i) => {
        const Icon = file.type.startsWith('image/') ? ImageIcon : FileText;
        return (
          <li key={`${file.name}-${file.size}-${file.lastModified}-${i}`} className="sp-file">
            <Icon aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="max-w-[170px] truncate font-medium text-foreground">{file.name}</span>
            <span className="text-muted-foreground tabular-nums">{humanSize(file.size)}</span>
            <button type="button" disabled={disabled} aria-label={`Remover ${file.name}`} onClick={() => onChange(files.filter((_, index) => index !== i))}><X className="h-3.5 w-3.5" /></button>
          </li>
        );
      })}
    </ul>
  );
}
