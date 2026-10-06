import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { humanSize } from '@/lib/ticketAttachments';
export interface SupportFilesProps { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }
export function SupportFiles({ files, onChange, disabled }: SupportFilesProps) {
  return <div className="flex flex-wrap gap-2">{files.map((file, i) => <span key={`${file.name}-${file.size}-${file.lastModified}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs">
    <Paperclip className="h-3 w-3 shrink-0" /><span className="max-w-[160px] truncate">{file.name}</span><span className="text-muted-foreground tabular-nums">{humanSize(file.size)}</span>
    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={disabled} aria-label={`Remover ${file.name}`} onClick={() => onChange(files.filter((_, index) => index !== i))}><X /></Button>
  </span>)}</div>;
}
