/**
 * Centralized zod schemas + shared validators for critical forms.
 * Used in DadosBancarios, ProductEditor, CheckoutBuilder, Auth, etc.
 */
import { z } from "zod";

/* ─────────── Document validators (CPF / CNPJ) ─────────── */
export function isValidCPF(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10) r = 0;
  return r === parseInt(d[10]);
}

export function isValidCNPJ(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let s = 0;
  for (let i = 0; i < 12; i++) s += parseInt(d[i]) * w1[i];
  let r = s % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  if (parseInt(d[12]) !== d1) return false;
  s = 0;
  for (let i = 0; i < 13; i++) s += parseInt(d[i]) * w2[i];
  r = s % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  return parseInt(d[13]) === d2;
}

export const documentSchema = z
  .string()
  .trim()
  .nonempty({ message: "CPF/CNPJ é obrigatório" })
  .refine(
    (v) => {
      const d = v.replace(/\D/g, "");
      if (d.length === 11) return isValidCPF(d);
      if (d.length === 14) return isValidCNPJ(d);
      return false;
    },
    { message: "Informe um CPF ou CNPJ válido" },
  );

/* ─────────── PIX key ─────────── */
export const pixKeySchema = z
  .object({
    key_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]),
    key_value: z.string().trim().nonempty({ message: "Informe a chave PIX" }),
  })
  .superRefine((data, ctx) => {
    const v = data.key_value;
    switch (data.key_type) {
      case "cpf":
        if (!isValidCPF(v)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["key_value"], message: "CPF inválido" });
        }
        break;
      case "cnpj":
        if (!isValidCNPJ(v)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["key_value"], message: "CNPJ inválido" });
        }
        break;
      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["key_value"], message: "E-mail inválido" });
        }
        break;
      case "phone": {
        const d = v.replace(/\D/g, "");
        if (d.length < 10 || d.length > 13) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["key_value"], message: "Telefone inválido (DDD + número)" });
        }
        break;
      }
      case "random":
        if (v.length < 32) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["key_value"], message: "Chave aleatória deve ter 32+ caracteres" });
        }
        break;
    }
  });

/* ─────────── Bank account ─────────── */
export const bankAccountSchema = z.object({
  bank_name: z.string().trim().min(2, { message: "Nome do banco obrigatório" }).max(80),
  bank_code: z.string().trim().max(10).optional().or(z.literal("")),
  agency: z
    .string()
    .trim()
    .nonempty({ message: "Agência obrigatória" })
    .max(10)
    .refine((v) => /^\d{1,5}(-?\d)?$/.test(v), { message: "Agência inválida (apenas números)" }),
  account_number: z
    .string()
    .trim()
    .nonempty({ message: "Conta obrigatória" })
    .max(20)
    .refine((v) => /^\d{1,15}(-?\d{1,2})?$/.test(v), { message: "Conta inválida (apenas números, dígito opcional após o -)" }),
  account_type: z.enum(["corrente", "poupanca"]),
  holder_name: z.string().trim().min(3, { message: "Nome do titular muito curto" }).max(120),
  holder_document: documentSchema,
});

/* ─────────── Product editor ─────────── */
export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { message: "Nome do produto deve ter no mínimo 3 caracteres" })
    .max(120, { message: "Nome muito longo (máx. 120)" })
    .refine((v) => v.toLowerCase() !== "novo produto", { message: "Defina um nome real para o produto" }),
  description: z
    .string()
    .trim()
    .min(10, { message: "Descrição muito curta (mín. 10 caracteres)" })
    .max(2000, { message: "Descrição muito longa (máx. 2000)" }),
  price: z
    .number({ invalid_type_error: "Preço inválido" })
    .min(1, { message: "Preço mínimo R$ 1,00" })
    .max(999999, { message: "Preço máximo R$ 999.999,00" }),
  affiliate_commission: z
    .number()
    .min(0, { message: "Comissão não pode ser negativa" })
    .max(90, { message: "Comissão máxima de 90%" })
    .optional(),
});

/* ─────────── Checkout slug ─────────── */
export const checkoutSlugSchema = z
  .string()
  .trim()
  .min(3, { message: "Slug muito curto (mín. 3)" })
  .max(60, { message: "Slug muito longo (máx. 60)" })
  .regex(/^[a-z0-9-]+$/, { message: "Use apenas letras minúsculas, números e hífen" });

/* ─────────── Payment links ─────────── */
const optionalPositiveInteger = z.union([
  z.literal(""),
  z.coerce.number().int().positive(),
]);

export const paymentLinkFormSchema = z.object({
  title: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres").max(120),
  description: z.string().trim().max(500),
  amount: z.coerce.number().min(1, "O valor mínimo é R$ 1,00").max(999999, "O valor máximo é R$ 999.999,00"),
  slug: checkoutSlugSchema,
  max_uses: optionalPositiveInteger,
  expires_at: z.string(),
  pix_expiration_minutes: z.coerce.number().int().min(5).max(1440),
  instructions: z.string().trim().max(1000),
  redirect_url: z.union([
    z.literal(""),
    z.string().trim().url("Informe uma URL completa e válida").max(500).refine(
      (value) => value.startsWith("https://") || value.startsWith("http://"),
      "Use um endereço iniciado por https:// ou http://",
    ),
  ]),
  accept_pix: z.boolean(),
  accept_card: z.boolean(),
  accept_boleto: z.boolean(),
}).superRefine((value, ctx) => {
  if (!value.accept_pix && !value.accept_card && !value.accept_boleto) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["accept_pix"], message: "Ative ao menos um método liberado" });
  }
  if (value.expires_at && new Date(value.expires_at).getTime() <= Date.now()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expires_at"], message: "A validade deve estar no futuro" });
  }
});

export type PaymentLinkFormValues = z.input<typeof paymentLinkFormSchema>;

/* ─────────── Helpers ─────────── */
export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** Convert a ZodError into a flat field→message map. */
export function flattenZodErrors<T extends Record<string, unknown>>(
  error: z.ZodError,
): FieldErrors<T> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) result[key] = issue.message;
  }
  return result as FieldErrors<T>;
}
