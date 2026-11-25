import type { ReactNode } from "react";
import { useCourseFileUrl } from "@/lib/courseFiles";

type Props = {
  fileUrl: string;
  fileName: string;
  className?: string;
  /** Texto para leitor de tela e dica ao passar o mouse. */
  label: string;
  children: ReactNode;
};

/**
 * Link de download de um material do bucket privado: pede o link assinado ao montar
 * e baixa com o nome original. Se não conseguir assinar, vira botão de tentar de novo.
 */
export function SignedFileLink({ fileUrl, fileName, className, label, children }: Props) {
  const file = useCourseFileUrl(fileUrl, { downloadName: fileName });

  if (file.status === "error") {
    return (
      <button type="button" onClick={file.retry} className={className} aria-label={`Tentar de novo: ${label}`} title="Não foi possível preparar o arquivo. Toque para tentar de novo.">
        {children}
      </button>
    );
  }
  if (file.status !== "ready") {
    return <span aria-disabled="true" aria-label={label} title="Preparando o arquivo…" className={`${className ?? ""} opacity-60`}>{children}</span>;
  }
  return (
    <a href={file.src} download={fileName} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={className}>
      {children}
    </a>
  );
}
