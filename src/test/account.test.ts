import { describe, expect, it } from "vitest";
import {
  addressFrom, avatarPath, canEditDocs, cepDigits, docObjectName, docTypeOf, documentLabel, formatCep, formatPhone, hasAddress, kycBanner, topbarKyc, kycInfo, kycSteps,
  kycSubmitError, memberFor, newestByType, normalizeAddress, parseAccountTab, passwordChangeError, passwordChecks, passwordProblem, payoutChecklist,
  profileSaveError, sameAddress, staleNames, validateAddress, validateAvatarFile, validateFullName, validateNickname, validatePhone, versionedUrl,
  EMPTY_ADDRESS, type AddressForm,
} from "@/components/account/accountMeta";

const full: AddressForm = { zip_code: "87020-025", street: "Avenida Brasil", street_number: "100", complement: "", neighborhood: "Zona 01", city: "Maringá", state: "PR" };

describe("abas", () => {
  it("mantém os links antigos funcionando", () => {
    expect(parseAccountTab("identidade")).toBe("identidade");
    expect(parseAccountTab("seguranca")).toBe("seguranca");
    expect(parseAccountTab(null)).toBe("perfil");
    expect(parseAccountTab("qualquer")).toBe("perfil");
  });
});

describe("status da verificação", () => {
  it("conhece os cinco estados e cai em pendente quando o valor é estranho", () => {
    expect(kycInfo("approved").tone).toBe("ok");
    expect(kycInfo("pending_review").tone).toBe("wait");
    expect(kycInfo("rejected").tone).toBe("alert");
    expect(kycInfo("blocked").label).toBe("Conta bloqueada");
    expect(kycInfo(undefined).key).toBe("pending");
    expect(kycInfo("xyz").key).toBe("pending");
  });
  it("só deixa trocar documento antes do envio ou depois de reprovar", () => {
    expect(canEditDocs("pending")).toBe(true);
    expect(canEditDocs("rejected")).toBe(true);
    expect(canEditDocs("pending_review")).toBe(false);
    expect(canEditDocs("approved")).toBe(false);
    expect(canEditDocs("blocked")).toBe(false);
  });
  it("etapas: contagem de enviados, falta enviar, análise e aprovada", () => {
    const [a] = kycSteps("pending", 2, 3);
    expect(a).toMatchObject({ state: "current", note: "2 de 3 enviados" });
    expect(kycSteps("pending", 3, 3)[0].note).toBe("Falta enviar para análise");
    const review = kycSteps("pending_review", 3, 3);
    expect(review.map((s) => s.state)).toEqual(["done", "current", "todo"]);
    expect(kycSteps("rejected", 3, 3)[0].state).toBe("alert");
    expect(kycSteps("approved", 3, 3).every((s) => s.state === "done")).toBe(true);
  });
});

describe("o que falta para sacar", () => {
  it("só fica pronto com verificação, endereço e uma chave Pix; a conta bancária é opcional", () => {
    expect(payoutChecklist({ approved: true, hasAddress: true, pixCount: 1, bankCount: 0 }).ready).toBe(true);
    expect(payoutChecklist({ approved: true, hasAddress: false, pixCount: 1, bankCount: 0 }).ready).toBe(false);
    expect(payoutChecklist({ approved: true, hasAddress: true, pixCount: 0, bankCount: 3 }).ready).toBe(false);
    expect(payoutChecklist({ approved: false, hasAddress: true, pixCount: 1, bankCount: 0 }).ready).toBe(false);
  });
  it("aponta cada pendência para a tela certa", () => {
    const { items } = payoutChecklist({ approved: false, hasAddress: false, pixCount: 0, bankCount: 0 });
    expect(items.find((i) => i.key === "address")?.to).toBe("/perfil?focus=address");
    expect(items.find((i) => i.key === "pix")?.to).toBe("/financeiro/config");
    expect(items.find((i) => i.key === "kyc")?.to).toBe("/perfil?tab=identidade");
  });
  it("a linha da verificação informa o andamento e só leva a outro lugar quando bloqueada", () => {
    const row = (kyc: Parameters<typeof payoutChecklist>[0]["kyc"]) => payoutChecklist({ approved: false, kyc, hasAddress: true, pixCount: 1, bankCount: 0 }).items[0];
    expect(row("pending_review")).toMatchObject({ cta: null, done: false });
    expect(row("pending_review").text).toMatch(/Em análise/);
    expect(row("rejected").text).toMatch(/Reprovada/);
    expect(row("pending").cta).toBeNull();
    expect(row("blocked")).toMatchObject({ to: "/suporte", cta: "Falar com o suporte" });
  });
});

describe("documentos no storage", () => {
  it("reconhece os dois formatos de nome e ignora o resto", () => {
    expect(docTypeOf("front_ab12cd34.jpg")).toBe("front");
    expect(docTypeOf("selfie.png")).toBe("selfie");
    expect(docTypeOf("cnpj_card_1a2b3c4d.webp")).toBe("cnpj_card");
    expect(docTypeOf("backup.jpg")).toBeNull();
    expect(docTypeOf(".emptyFolderPlaceholder")).toBeNull();
  });
  it("pega o mais recente de cada tipo", () => {
    const files = [
      { name: "front_a.jpg", created_at: "2026-11-01T10:00:00Z" },
      { name: "front_b.jpg", created_at: "2026-11-03T10:00:00Z" },
      { name: "back_a.jpg", created_at: "2026-11-02T10:00:00Z" },
      { name: "outro.txt", created_at: "2026-11-09T10:00:00Z" },
    ];
    const pick = newestByType(files);
    expect(pick.front?.name).toBe("front_b.jpg");
    expect(pick.back?.name).toBe("back_a.jpg");
    expect(pick.selfie).toBeUndefined();
  });
  it("lista só os nomes antigos do mesmo tipo para apagar", () => {
    const files = [{ name: "front_a.jpg" }, { name: "front_b.jpg" }, { name: "back_a.jpg" }];
    expect(staleNames(files, "front", "front_b.jpg")).toEqual(["front_a.jpg"]);
  });
  it("gera nome com a extensão do tipo do arquivo", () => {
    expect(docObjectName("front", "ab12", "image/png")).toBe("front_ab12.png");
    expect(docObjectName("selfie", "ab12", "image/webp")).toBe("selfie_ab12.webp");
  });
});

describe("telefone", () => {
  it("formata fixo e celular", () => {
    expect(formatPhone("44999990000")).toBe("(44) 99999-0000");
    expect(formatPhone("4433334444")).toBe("(44) 3333-4444");
    expect(formatPhone("+55 44 99999-0000")).toBe("(44) 99999-0000");
    expect(formatPhone("4")).toBe("(4");
    expect(formatPhone("")).toBe("");
  });
  it("valida DDD, tamanho e o 9 do celular", () => {
    expect(validatePhone("(44) 99999-0000")).toBeNull();
    expect(validatePhone("(44) 3333-4444")).toBeNull();
    expect(validatePhone("")).toMatch(/DDD/);
    expect(validatePhone("999990000")).toMatch(/DDD/);
    expect(validatePhone("(05) 99999-0000")).toMatch(/DDD não existe/);
    expect(validatePhone("(44) 89999-0000")).toMatch(/começa com 9/);
  });
});

describe("nome e apelido", () => {
  it("apelido de 2 a 30 caracteres com letra ou número", () => {
    expect(validateNickname("")).toMatch(/Escreva/);
    expect(validateNickname("a")).toMatch(/pelo menos 2/);
    expect(validateNickname("x".repeat(31))).toMatch(/no máximo 30/);
    expect(validateNickname("!!!")).toMatch(/letras ou números/);
    expect(validateNickname("  Lu  ")).toBeNull();
    expect(validateNickname("Mari 2")).toBeNull();
  });
  it("nome completo", () => {
    expect(validateFullName("ab")).toMatch(/nome completo/);
    expect(validateFullName("123 456")).toMatch(/letras/);
    expect(validateFullName("Lucker Silva")).toBeNull();
  });
});

describe("endereço", () => {
  it("aceita o endereço completo e não exige bairro nem complemento", () => {
    expect(validateAddress(full)).toEqual({});
    expect(validateAddress({ ...full, neighborhood: "", complement: "" })).toEqual({});
  });
  it("aponta cada campo que falta", () => {
    const e = validateAddress(EMPTY_ADDRESS);
    expect(Object.keys(e).sort()).toEqual(["city", "state", "street", "street_number", "zip_code"]);
    expect(validateAddress({ ...full, zip_code: "8702" }).zip_code).toMatch(/8 números/);
    expect(validateAddress({ ...full, state: "XX" }).state).toMatch(/estado/);
    expect(validateAddress({ ...full, street_number: "S/N" })).toEqual({});
  });
  it("formata o CEP e normaliza espaços e UF", () => {
    expect(formatCep("87020025")).toBe("87020-025");
    expect(formatCep("87020-02599")).toBe("87020-025");
    expect(cepDigits("87.020-025")).toBe("87020025");
    expect(normalizeAddress({ ...full, street: "  Avenida   Brasil ", state: "pr" })).toMatchObject({ street: "Avenida Brasil", state: "PR" });
  });
  it("lê o endereço do perfil, mesmo com CEP sem traço e campos nulos", () => {
    expect(addressFrom({ zip_code: "87020025", street: "Avenida Brasil", street_number: "100", city: "Maringá", state: "pr", complement: null, neighborhood: null })).toMatchObject({ zip_code: "87020-025", state: "PR", complement: "" });
    expect(addressFrom(null)).toEqual(EMPTY_ADDRESS);
  });
  it("compara endereços sem ligar para espaços", () => {
    expect(sameAddress(full, { ...full, street: " Avenida Brasil " })).toBe(true);
    expect(sameAddress(full, { ...full, street_number: "101" })).toBe(false);
  });
  it("usa a mesma regra de saques para dizer que há endereço", () => {
    expect(hasAddress(full)).toBe(true);
    expect(hasAddress({ ...full, city: "" })).toBe(false);
    expect(hasAddress(null)).toBe(false);
    expect(hasAddress({ ...full, neighborhood: null, complement: null })).toBe(true);
  });
});

describe("senha", () => {
  it("confere as quatro regras", () => {
    expect(passwordChecks("abc")).toEqual({ length: false, lower: true, upper: false, digit: false });
    expect(passwordChecks("Abcdefg1")).toEqual({ length: true, lower: true, upper: true, digit: true });
  });
  it("devolve o primeiro problema, na ordem em que o vendedor corrige", () => {
    expect(passwordProblem("", "Abcdefg1", "Abcdefg1")).toMatch(/senha atual/);
    expect(passwordProblem("x", "Abc1", "Abc1")).toMatch(/8 caracteres/);
    expect(passwordProblem("x", "abcdefgh", "abcdefgh")).toMatch(/maiúscula/);
    expect(passwordProblem("Abcdefg1", "Abcdefg1", "Abcdefg1")).toMatch(/diferente/);
    expect(passwordProblem("antiga", "Abcdefg1", "Abcdefg2")).toMatch(/não são iguais/);
    expect(passwordProblem("antiga", "Abcdefg1", "Abcdefg1")).toBeNull();
    expect(passwordProblem("antiga", "Aa1" + "x".repeat(70), "Aa1" + "x".repeat(70))).toMatch(/72/);
  });
  it("traduz os erros do servidor", () => {
    expect(passwordChangeError(new Error("Invalid login credentials"))).toBe("A senha atual não confere.");
    expect(passwordChangeError({ message: "New password should be different from the old password." })).toMatch(/diferente/);
    expect(passwordChangeError({ message: "Password is known to be weak and easy to guess" })).toMatch(/fácil de adivinhar/);
    expect(passwordChangeError({ message: "email rate limit exceeded" })).toMatch(/Muitas tentativas/);
  });
});

describe("foto de perfil", () => {
  it("aceita JPG, PNG e WebP até 10 MB", () => {
    expect(validateAvatarFile({ type: "image/png", size: 500_000 })).toBeNull();
    expect(validateAvatarFile({ type: "image/gif", size: 500_000 })).toMatch(/JPG, PNG ou WebP/);
    expect(validateAvatarFile({ type: "image/jpeg", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(validateAvatarFile({ type: "image/jpeg", size: 0 })).toMatch(/vazio/);
  });
  it("o caminho vem do tipo (o bucket só aceita nomes simples) e a URL ganha versão", () => {
    expect(avatarPath("u1", "image/jpeg")).toBe("u1/avatar.jpg");
    expect(avatarPath("u1", "image/webp")).toBe("u1/avatar.webp");
    expect(versionedUrl("https://x/a.jpg?v=1", 99)).toBe("https://x/a.jpg?v=99");
  });
});

describe("mensagens de erro", () => {
  it("endereço travado e telefone repetido", () => {
    expect(profileSaveError({ message: "Endereço travado: contate o suporte para alterar", hint: "address_locked", code: "42501" })).toMatch(/travado/);
    expect(profileSaveError({ message: 'duplicate key value violates unique constraint "idx_profiles_phone_unique"', details: "Key (phone)=(44999990000) already exists.", code: "23505" })).toBe("Este telefone já está em uso em outra conta.");
    expect(profileSaveError({ message: "Alteração de campo administrativo não permitida", hint: "profile_restricted_field" })).toMatch(/suporte/);
    expect(profileSaveError({ message: "Failed to fetch" })).toBe("Sem conexão. Tente novamente.");
  });
  it("envio para análise", () => {
    expect(kycSubmitError({ message: "no_documents_uploaded" })).toMatch(/Envie as fotos/);
    expect(kycSubmitError({ message: "not_authenticated" })).toMatch(/sessão expirou/);
  });
});

describe("textos", () => {
  it("tempo de conta", () => {
    const now = new Date("2026-11-24T12:00:00Z").getTime();
    expect(memberFor("2026-11-24T08:00:00Z", now)).toBe("hoje");
    expect(memberFor("2026-11-23T08:00:00Z", now)).toBe("1 dia");
    expect(memberFor("2026-11-04T08:00:00Z", now)).toBe("20 dias");
    expect(memberFor("2026-08-20T08:00:00Z", now)).toBe("3 meses");
    expect(memberFor("2025-09-20T08:00:00Z", now)).toBe("1 ano e 2 meses");
    expect(memberFor(null, now)).toBe("—");
  });
  it("documento mostra só o final ou a máscara do banco", () => {
    expect(documentLabel({ document_type: "cpf", document_number: "12345678900" })).toBe("CPF final 8900");
    expect(documentLabel({ document_type: "cnpj", document_number: null, document_number_masked: "**.***.***/0001-**" })).toBe("CNPJ **.***.***/0001-**");
    expect(documentLabel({ document_type: "cpf" })).toBe("Não informado");
  });
});

describe("avisos de verificação", () => {
  it("conta verificada não tem faixa", () => {
    expect(kycBanner("approved")).toBeNull();
  });
  it("cada status tem a sua faixa e leva para o lugar certo", () => {
    expect(kycBanner("pending")).toMatchObject({ tone: "warn", to: "/perfil?tab=identidade&scrollTo=kyc" });
    expect(kycBanner("pending_review")?.text).toMatch(/em análise/);
    expect(kycBanner("pending_review")?.text).not.toMatch(/Envie/);
    expect(kycBanner("rejected")).toMatchObject({ tone: "alert", to: "/perfil?tab=identidade&scrollTo=kyc" });
    expect(kycBanner("blocked")).toMatchObject({ tone: "alert", to: "/suporte" });
  });
});

describe("selo do topo", () => {
  it("diz a situação real da conta, não só verificada ou pendente", () => {
    expect(topbarKyc("approved")).toEqual({ label: "Conta verificada", tone: "ok" });
    expect(topbarKyc("pending_review").label).toBe("Em análise");
    expect(topbarKyc("rejected").tone).toBe("alert");
    expect(topbarKyc("blocked").label).toBe("Conta bloqueada");
    expect(topbarKyc("pending").label).toBe("Verificação pendente");
  });
});
