import { describe, it, expect } from "vitest";
import {
  isValidCPF,
  isValidCNPJ,
  documentSchema,
  pixKeySchema,
  bankAccountSchema,
  productSchema,
  checkoutSlugSchema,
  paymentLinkFormSchema,
  flattenZodErrors,
} from "@/lib/validation";
import { detectPixKeyType, maskAccount, maskAgency, maskDocument, maskPhone, maskSensitivePixKey } from "@/lib/financial-input";
import { spreadsheetSafe } from "@/lib/sales-export";
import {
  checkoutCustomerSchema,
  formatCheckoutCep,
  formatCheckoutDocument,
  formatCheckoutPhone,
  isValidCardExpiry,
  isValidCardNumber,
} from "@/features/public-checkout/checkoutSchema";

/**
 * Onda 5 — Unit tests for the centralized validation lib.
 * Covers CPF/CNPJ check digits, PIX key variants, bank accounts,
 * product schema, checkout slug and the error flattener.
 */

describe("isValidCPF", () => {
  it("accepts known valid CPFs", () => {
    expect(isValidCPF("52998224725")).toBe(true);
    expect(isValidCPF("11144477735")).toBe(true);
  });
  it("rejects all-equal digits", () => {
    expect(isValidCPF("11111111111")).toBe(false);
    expect(isValidCPF("00000000000")).toBe(false);
  });
  it("rejects wrong length", () => {
    expect(isValidCPF("1234567890")).toBe(false);
    expect(isValidCPF("123456789000")).toBe(false);
  });
  it("rejects invalid check digits", () => {
    expect(isValidCPF("12345678900")).toBe(false);
  });
  it("accepts formatted input", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
  });
});

describe("isValidCNPJ", () => {
  it("accepts a known valid CNPJ", () => {
    expect(isValidCNPJ("11222333000181")).toBe(true);
  });
  it("rejects all-equal digits", () => {
    expect(isValidCNPJ("11111111111111")).toBe(false);
  });
  it("rejects invalid check digits", () => {
    expect(isValidCNPJ("11222333000180")).toBe(false);
  });
  it("rejects wrong length", () => {
    expect(isValidCNPJ("1122233300018")).toBe(false);
  });
});

describe("documentSchema", () => {
  it("accepts valid CPF and CNPJ", () => {
    expect(documentSchema.safeParse("529.982.247-25").success).toBe(true);
    expect(documentSchema.safeParse("11222333000181").success).toBe(true);
  });
  it("rejects empty/invalid documents", () => {
    expect(documentSchema.safeParse("").success).toBe(false);
    expect(documentSchema.safeParse("12345").success).toBe(false);
    expect(documentSchema.safeParse("12345678900").success).toBe(false);
  });
});

describe("pixKeySchema", () => {
  it("validates CPF key", () => {
    expect(pixKeySchema.safeParse({ key_type: "cpf", key_value: "52998224725" }).success).toBe(true);
    expect(pixKeySchema.safeParse({ key_type: "cpf", key_value: "12345678900" }).success).toBe(false);
  });
  it("validates CNPJ key", () => {
    expect(pixKeySchema.safeParse({ key_type: "cnpj", key_value: "11222333000181" }).success).toBe(true);
    expect(pixKeySchema.safeParse({ key_type: "cnpj", key_value: "00000000000000" }).success).toBe(false);
  });
  it("validates email key", () => {
    expect(pixKeySchema.safeParse({ key_type: "email", key_value: "user@hotzfy.com" }).success).toBe(true);
    expect(pixKeySchema.safeParse({ key_type: "email", key_value: "not-an-email" }).success).toBe(false);
  });
  it("validates phone key (digits only counted)", () => {
    expect(pixKeySchema.safeParse({ key_type: "phone", key_value: "+5511987654321" }).success).toBe(true);
    expect(pixKeySchema.safeParse({ key_type: "phone", key_value: "1234" }).success).toBe(false);
  });
  it("validates random key length", () => {
    const ok = "a".repeat(36);
    const tooShort = "a".repeat(20);
    expect(pixKeySchema.safeParse({ key_type: "random", key_value: ok }).success).toBe(true);
    expect(pixKeySchema.safeParse({ key_type: "random", key_value: tooShort }).success).toBe(false);
  });
  it("rejects empty value", () => {
    expect(pixKeySchema.safeParse({ key_type: "cpf", key_value: "" }).success).toBe(false);
  });
});

describe("bankAccountSchema", () => {
  const base = {
    bank_name: "Nubank",
    bank_code: "260",
    agency: "0001",
    account_number: "12345-6",
    account_type: "corrente" as const,
    holder_name: "João da Silva",
    holder_document: "529.982.247-25",
  };
  it("accepts a valid payload", () => {
    expect(bankAccountSchema.safeParse(base).success).toBe(true);
  });
  it("rejects short bank name", () => {
    expect(bankAccountSchema.safeParse({ ...base, bank_name: "N" }).success).toBe(false);
  });
  it("rejects non-numeric agency/account", () => {
    expect(bankAccountSchema.safeParse({ ...base, agency: "00A1" }).success).toBe(false);
    expect(bankAccountSchema.safeParse({ ...base, account_number: "12-AB" }).success).toBe(false);
  });
  it("rejects invalid holder document", () => {
    expect(bankAccountSchema.safeParse({ ...base, holder_document: "12345" }).success).toBe(false);
  });
  it("allows empty optional bank_code", () => {
    expect(bankAccountSchema.safeParse({ ...base, bank_code: "" }).success).toBe(true);
  });
});

describe("productSchema", () => {
  const base = { name: "Curso Premium", description: "Um curso completo sobre vendas online.", price: 197, affiliate_commission: 30 };
  it("accepts a valid product", () => {
    expect(productSchema.safeParse(base).success).toBe(true);
  });
  it("rejects placeholder name", () => {
    expect(productSchema.safeParse({ ...base, name: "novo produto" }).success).toBe(false);
  });
  it("rejects short description", () => {
    expect(productSchema.safeParse({ ...base, description: "curto" }).success).toBe(false);
  });
  it("rejects price below minimum", () => {
    expect(productSchema.safeParse({ ...base, price: 0 }).success).toBe(false);
  });
  it("rejects commission > 90%", () => {
    expect(productSchema.safeParse({ ...base, affiliate_commission: 95 }).success).toBe(false);
  });
  it("allows omitting commission", () => {
    const { affiliate_commission: _omit, ...rest } = base;
    expect(productSchema.safeParse(rest).success).toBe(true);
  });
});

describe("checkoutSlugSchema", () => {
  it("accepts lowercase-hyphen slugs", () => {
    expect(checkoutSlugSchema.safeParse("curso-vendas-2026").success).toBe(true);
  });
  it("rejects uppercase, spaces or special chars", () => {
    expect(checkoutSlugSchema.safeParse("Curso Vendas").success).toBe(false);
    expect(checkoutSlugSchema.safeParse("curso_vendas").success).toBe(false);
    expect(checkoutSlugSchema.safeParse("curso!").success).toBe(false);
  });
  it("rejects too short / too long", () => {
    expect(checkoutSlugSchema.safeParse("ab").success).toBe(false);
    expect(checkoutSlugSchema.safeParse("a".repeat(80)).success).toBe(false);
  });
});

describe("paymentLinkFormSchema", () => {
  const valid = {
    title: "Consultoria Premium",
    description: "Atendimento individual",
    amount: 197,
    slug: "consultoria-premium",
    max_uses: "10",
    expires_at: "",
    pix_expiration_minutes: 30,
    instructions: "Envie o comprovante após o pagamento.",
    redirect_url: "https://example.com/obrigado",
    accept_pix: true,
    accept_card: false,
    accept_boleto: false,
  };

  it("accepts a complete single payment link", () => {
    expect(paymentLinkFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires an allowed payment method", () => {
    expect(paymentLinkFormSchema.safeParse({ ...valid, accept_pix: false }).success).toBe(false);
  });

  it("rejects invalid amounts and redirect URLs", () => {
    expect(paymentLinkFormSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
    expect(paymentLinkFormSchema.safeParse({ ...valid, redirect_url: "javascript:alert(1)" }).success).toBe(false);
  });

  it("rejects a past expiration date", () => {
    expect(paymentLinkFormSchema.safeParse({ ...valid, expires_at: "2020-01-01T10:00" }).success).toBe(false);
  });
});

describe("flattenZodErrors", () => {
  it("returns first error per field as flat map", () => {
    const result = bankAccountSchema.safeParse({
      bank_name: "",
      agency: "",
      account_number: "",
      account_type: "corrente",
      holder_name: "",
      holder_document: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errs = flattenZodErrors<Record<string, unknown>>(result.error);
      expect(errs.bank_name).toBeTruthy();
      expect(errs.agency).toBeTruthy();
      expect(errs.account_number).toBeTruthy();
      expect(errs.holder_name).toBeTruthy();
      expect(errs.holder_document).toBeTruthy();
    }
  });
});

describe("financial input formatting", () => {
  it("formats Brazilian documents and bank fields", () => {
    expect(maskDocument("52998224725")).toBe("529.982.247-25");
    expect(maskDocument("11222333000181")).toBe("11.222.333/0001-81");
    expect(maskAgency("123456")).toBe("12345-6");
    expect(maskAccount("123456")).toBe("12345-6");
    expect(maskPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("detects PIX key types without guessing incomplete values", () => {
    expect(detectPixKeyType("529.982.247-25")).toBe("cpf");
    expect(detectPixKeyType("11.222.333/0001-81")).toBe("cnpj");
    expect(detectPixKeyType("seller@example.com")).toBe("email");
    expect(detectPixKeyType("(11) 98765-4321")).toBe("phone");
    expect(detectPixKeyType("12345")).toBeNull();
  });

  it("masks PII before rendering it", () => {
    expect(maskSensitivePixKey("52998224725", "cpf")).toBe("•••• 4725");
    expect(maskSensitivePixKey("seller@example.com", "email")).toBe("se•••@example.com");
  });
});

describe("spreadsheet export safety", () => {
  it("neutralizes formula-like customer data", () => {
    expect(spreadsheetSafe("=HYPERLINK(\"https://evil.test\")")).toBe("'=HYPERLINK(\"https://evil.test\")");
    expect(spreadsheetSafe("+1+1")).toBe("'+1+1");
    expect(spreadsheetSafe("Cliente normal")).toBe("Cliente normal");
    expect(spreadsheetSafe(197)).toBe(197);
  });
});

describe("public checkout validation", () => {
  const validCustomer = {
    name: "Maria da Silva",
    email: "maria@example.com",
    emailConfirm: "maria@example.com",
    document: "529.982.247-25",
    phone: "(11) 98765-4321",
    addressRequired: false,
  };

  it("accepts normalized buyer data and matching email", () => {
    const result = checkoutCustomerSchema.safeParse(validCustomer);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("maria@example.com");
  });

  it("rejects invalid documents, phones and email confirmation", () => {
    expect(checkoutCustomerSchema.safeParse({ ...validCustomer, document: "123", phone: "123", emailConfirm: "outra@example.com" }).success).toBe(false);
  });

  it("requires a complete address only when configured", () => {
    expect(checkoutCustomerSchema.safeParse({ ...validCustomer, addressRequired: true }).success).toBe(false);
    expect(checkoutCustomerSchema.safeParse({ ...validCustomer, addressRequired: true, cep: "01310-100", street: "Avenida Paulista", number: "1000", neighborhood: "Bela Vista", city: "São Paulo", state: "SP" }).success).toBe(true);
  });

  it("formats document, phone and CEP without accepting extra digits", () => {
    expect(formatCheckoutDocument("52998224725")).toBe("529.982.247-25");
    expect(formatCheckoutDocument("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCheckoutPhone("5511987654321")).toBe("(11) 98765-4321");
    expect(formatCheckoutCep("01310100")).toBe("01310-100");
  });

  it("validates card metadata without retaining card data", () => {
    expect(isValidCardNumber("4242 4242 4242 4242")).toBe(true);
    expect(isValidCardNumber("4242 4242 4242 4241")).toBe(false);
    expect(isValidCardExpiry("12/30", new Date("2026-10-05T00:00:00Z"))).toBe(true);
    expect(isValidCardExpiry("09/26", new Date("2026-10-05T00:00:00Z"))).toBe(false);
  });
});
