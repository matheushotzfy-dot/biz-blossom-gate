import { isValidCNPJ, isValidCPF } from "@/lib/validation";

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

const digits = (value: string) => value.replace(/\D/g, "");

export function maskDocument(value: string): string {
  const raw = digits(value).slice(0, 14);
  if (raw.length <= 11) {
    return raw
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return raw
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskPhone(value: string): string {
  const raw = digits(value).replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (raw.length <= 10) {
    return raw.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return raw.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskAgency(value: string): string {
  const raw = digits(value).slice(0, 6);
  return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
}

export function maskAccount(value: string): string {
  const raw = digits(value).slice(0, 17);
  if (raw.length <= 1) return raw;
  const checkDigits = raw.length > 15 ? 2 : 1;
  return `${raw.slice(0, -checkDigits)}-${raw.slice(-checkDigits)}`;
}

export function detectPixKeyType(value: string): PixKeyType | null {
  const clean = value.trim();
  if (!clean) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return "email";
  const numeric = digits(clean);
  if (numeric.length === 11 && isValidCPF(numeric)) return "cpf";
  if (numeric.length === 14 && isValidCNPJ(numeric)) return "cnpj";
  if (/^\+?[\d\s().-]+$/.test(clean) && numeric.length >= 10 && numeric.length <= 13) return "phone";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean) || clean.length >= 32) return "random";
  return null;
}

export function formatPixKey(value: string, type: PixKeyType): string {
  if (type === "cpf" || type === "cnpj") return maskDocument(value);
  if (type === "phone") return maskPhone(value);
  return value.trimStart().slice(0, type === "email" ? 254 : 77);
}

export function maskSensitivePixKey(value: string | null | undefined, type: string): string {
  if (!value) return "••••";
  if (value.includes("•") || value.includes("*")) return value;
  if (type === "email") {
    const [name, domain] = value.split("@");
    if (!domain) return "••••";
    return `${name.slice(0, 2)}•••@${domain}`;
  }
  const raw = digits(value);
  if (["cpf", "cnpj", "phone", "telefone"].includes(type) && raw.length >= 4) return `•••• ${raw.slice(-4)}`;
  return value.length > 8 ? `${value.slice(0, 4)}••••${value.slice(-4)}` : "••••";
}
