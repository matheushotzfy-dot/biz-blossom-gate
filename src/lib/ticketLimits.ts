/** Limites dos anexos de chamado. Arquivo sem dependências para poder ser usado em regras puras e testes. */
export const MAX_FILE_SIZE_MB = 5;
export const MAX_FILES_PER_MESSAGE = 3;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const ACCEPTED_MIME = "image/*,application/pdf,.doc,.docx,.txt,.csv,.xls,.xlsx";
/** Extensões aceitas quando o navegador não informa o tipo do arquivo (colar, arrastar). */
export const ACCEPTED_EXT = ["png", "jpg", "jpeg", "gif", "webp", "avif", "heic", "pdf", "doc", "docx", "txt", "csv", "xls", "xlsx"];
