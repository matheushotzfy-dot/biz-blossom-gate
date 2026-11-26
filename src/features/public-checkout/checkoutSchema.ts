import { z } from "zod";
import { documentSchema } from "@/lib/validation";

const brazilianPhoneSchema = z.string().trim().refine((value) => {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return digits.length === 10 || digits.length === 11;
}, "Informe um telefone com DDD");

const checkoutDocumentSchema = z.string().trim().min(1, "Informe seu CPF ou CNPJ").pipe(documentSchema);

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido").max(255);

/** As 27 siglas de estado. O CEP preenche sozinho; quem digita à mão não passa "XX". */
export const BRAZIL_UFS = new Set(["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]);

export const checkoutCustomerSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo").max(120),
  email: emailSchema,
  emailConfirm: z.string().trim().toLowerCase().max(255).optional(),
  document: checkoutDocumentSchema,
  phone: brazilianPhoneSchema,
  addressRequired: z.boolean(),
  cep: z.string().trim().optional(),
  street: z.string().trim().max(160).optional(),
  number: z.string().trim().max(20).optional(),
  complement: z.string().trim().max(100).optional(),
  neighborhood: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(2).optional(),
}).superRefine((value, ctx) => {
  if (value.emailConfirm !== undefined && value.email !== value.emailConfirm) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["emailConfirm"], message: "Os e-mails não coincidem" });
  }
  if (!value.addressRequired) return;
  const required: Array<["cep" | "street" | "number" | "neighborhood" | "city" | "state", string]> = [
    ["cep", "Informe o CEP completo"], ["street", "Informe a rua"], ["number", "Informe o número"],
    ["neighborhood", "Informe o bairro"], ["city", "Informe a cidade"], ["state", "Informe o estado"],
  ];
  for (const [field, message] of required) {
    const fieldValue = value[field] ?? "";
    const validCep = field !== "cep" || fieldValue.replace(/\D/g, "").length === 8;
    if (!fieldValue || !validCep) { ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message }); continue; }
    if (field === "state" && !BRAZIL_UFS.has(fieldValue.toUpperCase())) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "Use a sigla do estado (ex.: SP)" });
  }
});

export type CheckoutCustomerInput = z.input<typeof checkoutCustomerSchema>;
export type CheckoutCustomer = z.output<typeof checkoutCustomerSchema>;

export function isValidCardNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function isValidCardExpiry(value: string, now = new Date()): boolean {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

export function formatCheckoutDocument(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function formatCheckoutPhone(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatCheckoutCep(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}