import { describe, expect, it } from "vitest";
import {
  EMPTY_SIGNUP, buildSignupRequest, fieldsOfStep, firstInvalidStep, formatDocument, formatPhone, passwordRules,
  passwordStrength, phoneDigits, secondsLeft, stepErrors, suggestEmail, summarySections, validateCompanyName,
  validateDocument, validateEmail, validateField, validateFullName, validateNickname, validatePassword,
  validatePasswordConfirmation, validatePhone, type SignupForm,
} from "@/features/auth/authModel";

const VALID_CPF = "529.982.247-25";
const VALID_CNPJ = "11.222.333/0001-81";

const filled = (over: Partial<SignupForm> = {}): SignupForm => ({
  ...EMPTY_SIGNUP,
  fullName: "Maria  da Silva ",
  nickname: " Mari ",
  email: " Maria@Gmail.com ",
  phone: "(11) 91234-5678",
  document: VALID_CPF,
  segment: "infoproduto",
  monthlyRevenue: "ate_10k",
  referralSource: "instagram",
  password: "Abcdef12",
  confirmPassword: "Abcdef12",
  acceptTerms: true,
  ...over,
});

describe("máscaras", () => {
  it("formata CPF e CNPJ enquanto digita e corta no tamanho", () => {
    expect(formatDocument("5299", "cpf")).toBe("529.9");
    expect(formatDocument("52998224725", "cpf")).toBe("529.982.247-25");
    expect(formatDocument("529982247259999", "cpf")).toBe("529.982.247-25");
    expect(formatDocument("11", "cnpj")).toBe("11");
    expect(formatDocument("112223330001", "cnpj")).toBe("11.222.333/0001");
    expect(formatDocument("11222333000181", "cnpj")).toBe(VALID_CNPJ);
    expect(formatDocument("abc", "cpf")).toBe("");
  });

  it("formata telefone com 10 ou 11 dígitos e aceita +55 colado", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("1")).toBe("(1");
    expect(formatPhone("119")).toBe("(11) 9");
    expect(formatPhone("1132345678")).toBe("(11) 3234-5678");
    expect(formatPhone("11912345678")).toBe("(11) 91234-5678");
    expect(formatPhone("+55 (11) 91234-5678")).toBe("(11) 91234-5678");
    expect(phoneDigits("5511912345678")).toBe("11912345678");
    expect(phoneDigits("119123456789999")).toBe("11912345678");
  });
});

describe("e-mail", () => {
  it("exige um endereço completo", () => {
    expect(validateEmail("")).toMatch(/Informe/);
    expect(validateEmail("maria")).toMatch(/não parece certo/);
    expect(validateEmail("maria@gmail")).toMatch(/não parece certo/);
    expect(validateEmail("maria@@gmail.com")).toMatch(/não parece certo/);
    expect(validateEmail("ma ria@gmail.com")).toMatch(/não parece certo/);
    expect(validateEmail("maria..x@gmail.com")).toMatch(/não parece certo/);
    expect(validateEmail("  Maria@Gmail.com ")).toBe("");
    expect(validateEmail(`${"a".repeat(250)}@x.com`)).toMatch(/não parece certo/);
  });

  it("sugere o provedor certo quando o domínio tem erro de digitação", () => {
    expect(suggestEmail("maria@gmial.com")).toBe("maria@gmail.com");
    expect(suggestEmail("maria@gmail.con")).toBe("maria@gmail.com");
    expect(suggestEmail("maria@hotmial.com")).toBe("maria@hotmail.com");
    expect(suggestEmail("maria@outlok.com")).toBe("maria@outlook.com");
    expect(suggestEmail("Maria@GMAIL.CO")).toBe("maria@gmail.com");
  });

  it("não sugere nada para domínio correto, desconhecido ou e-mail inválido", () => {
    expect(suggestEmail("maria@gmail.com")).toBeNull();
    expect(suggestEmail("maria@mail.com")).toBeNull();
    expect(suggestEmail("maria@minhaempresa.com.br")).toBeNull();
    expect(suggestEmail("maria@gmial")).toBeNull();
    expect(suggestEmail("maria")).toBeNull();
  });
});

describe("telefone", () => {
  it("valida DDD e a quantidade de números", () => {
    expect(validatePhone("")).toMatch(/Informe/);
    expect(validatePhone("(11) 9123")).toMatch(/Faltam números/);
    expect(validatePhone("(00) 91234-5678")).toMatch(/DDD/);
    expect(validatePhone("(10) 91234-5678")).toMatch(/DDD/);
    expect(validatePhone("(11) 81234-5678")).toMatch(/9 na frente/);
    expect(validatePhone("(11) 91234-5678")).toBe("");
    expect(validatePhone("(11) 3234-5678")).toBe("");
    expect(validatePhone("(11) 1234-5678")).toMatch(/não parece certo/);
  });
});

describe("nome e apelido", () => {
  it("pede nome e sobrenome só com letras", () => {
    expect(validateFullName("")).toMatch(/Informe/);
    expect(validateFullName("Maria")).toMatch(/nome e sobrenome/);
    expect(validateFullName("M S")).toMatch(/nome e sobrenome/);
    expect(validateFullName("Maria 2da Silva")).toMatch(/só letras/);
    expect(validateFullName("a".repeat(121))).toMatch(/longo/);
    expect(validateFullName("  Maria   da Silva ")).toBe("");
    expect(validateFullName("José D'Ávila-Souza Jr.")).toBe("");
    expect(validateFullName("Li Wu")).toBe("");
  });

  it("apelido de 2 a 30 caracteres", () => {
    expect(validateNickname(" ")).toMatch(/mínimo 2/);
    expect(validateNickname("M")).toMatch(/mínimo 2/);
    expect(validateNickname("Mari")).toBe("");
    expect(validateNickname("x".repeat(31))).toMatch(/30/);
  });
});

describe("documento", () => {
  it("confere o dígito verificador do CPF e do CNPJ", () => {
    expect(validateDocument("cpf", "")).toBe("Informe o CPF.");
    expect(validateDocument("cpf", "529.982")).toMatch(/Faltam 5/);
    expect(validateDocument("cpf", "111.111.111-11")).toMatch(/inválido/);
    expect(validateDocument("cpf", "529.982.247-24")).toMatch(/inválido/);
    expect(validateDocument("cpf", VALID_CPF)).toBe("");
    expect(validateDocument("cnpj", "11.222.333/0001-80")).toMatch(/CNPJ inválido/);
    expect(validateDocument("cnpj", VALID_CNPJ)).toBe("");
    expect(validateDocument("cnpj", VALID_CPF)).toMatch(/Faltam 3/);
  });

  it("razão social de 2 a 160 caracteres", () => {
    expect(validateCompanyName(" ")).toMatch(/razão social/);
    expect(validateCompanyName("Acme Ltda")).toBe("");
    expect(validateCompanyName("x".repeat(161))).toMatch(/160/);
  });
});

describe("senha", () => {
  it("segue a regra do servidor: 8+ com maiúscula, minúscula e número", () => {
    expect(validatePassword("")).toMatch(/Crie/);
    expect(validatePassword("abcdefgh")).toMatch(/maiúscula, minúscula e número/);
    expect(validatePassword("Abcdef1")).toMatch(/8 ou mais/);
    expect(validatePassword("ABCDEFG1")).toMatch(/maiúscula, minúscula e número/);
    expect(validatePassword("Abcdef12")).toBe("");
    expect(validatePassword(`Ab1${"x".repeat(126)}`)).toMatch(/128/);
    expect(validatePassword(`Ab1${"x".repeat(125)}`)).toBe("");
  });

  it("barra senhas muito comuns mesmo cumprindo a regra", () => {
    expect(validatePassword("Senha123")).toMatch(/muito comum/);
    expect(validatePassword("Password1")).toMatch(/muito comum/);
  });

  it("mostra cada regra separadamente", () => {
    const rules = passwordRules("abc");
    expect(rules.map((r) => [r.id, r.ok])).toEqual([["length", false], ["upper", false], ["lower", true], ["digit", false]]);
  });

  it("classifica a força em 0 a 3", () => {
    expect(passwordStrength("").level).toBe(0);
    expect(passwordStrength("abc").level).toBe(1);
    expect(passwordStrength("Senha123").level).toBe(1);
    expect(passwordStrength("Abcdef12")).toEqual({ level: 2, label: "Boa" });
    expect(passwordStrength("Abcdef12!")).toEqual({ level: 3, label: "Forte" });
    expect(passwordStrength("Abcdefghij12")).toEqual({ level: 3, label: "Forte" });
  });

  it("confirma a senha", () => {
    expect(validatePasswordConfirmation("Abcdef12", "")).toMatch(/de novo/);
    expect(validatePasswordConfirmation("Abcdef12", "Abcdef13")).toMatch(/não são iguais/);
    expect(validatePasswordConfirmation("Abcdef12", "Abcdef12")).toBe("");
  });
});

describe("passos", () => {
  it("cada passo valida só os campos dele", () => {
    expect(fieldsOfStep(1, "cpf")).toEqual(["fullName", "nickname"]);
    expect(fieldsOfStep(3, "cpf")).toEqual(["document"]);
    expect(fieldsOfStep(3, "cnpj")).toEqual(["document", "companyName"]);
    expect(fieldsOfStep(6, "cpf")).toEqual(["acceptTerms"]);
  });

  it("formulário vazio acusa o primeiro passo; preenchido passa em todos", () => {
    expect(firstInvalidStep(EMPTY_SIGNUP)).toBe(1);
    expect(firstInvalidStep(filled())).toBeNull();
    expect(Object.keys(stepErrors(1, EMPTY_SIGNUP))).toEqual(["fullName", "nickname"]);
  });

  it("razão social só é cobrada em conta PJ", () => {
    expect(validateField("companyName", filled())).toBe("");
    expect(firstInvalidStep(filled({ accountType: "cnpj", document: VALID_CNPJ }))).toBe(3);
    expect(firstInvalidStep(filled({ accountType: "cnpj", document: VALID_CNPJ, companyName: "Acme Ltda" }))).toBeNull();
  });

  it("aponta o passo certo quando o dado errado é de um passo anterior", () => {
    expect(firstInvalidStep(filled({ phone: "(11) 12" }))).toBe(2);
    expect(firstInvalidStep(filled({ segment: "" }))).toBe(4);
    expect(firstInvalidStep(filled({ confirmPassword: "outra" }))).toBe(5);
    expect(firstInvalidStep(filled({ acceptTerms: false }))).toBe(6);
  });
});

describe("envio", () => {
  it("monta o corpo limpo para a conta de pessoa física", () => {
    const body = buildSignupRequest(filled());
    expect(body.email).toBe("maria@gmail.com");
    expect(body.password).toBe("Abcdef12");
    expect(body.metadata).toEqual({
      full_name: "Maria da Silva",
      nickname: "Mari",
      document_number: "52998224725",
      document_type: "cpf",
      phone: "11912345678",
      referral_source: "instagram",
      company_name: null,
      segment: "infoproduto",
      monthly_revenue_band: "ate_10k",
    });
  });

  it("conta PJ leva a razão social e o tipo cnpj", () => {
    const body = buildSignupRequest(filled({ accountType: "cnpj", document: VALID_CNPJ, companyName: "  Acme   Ltda " }));
    expect(body.metadata.document_type).toBe("cnpj");
    expect(body.metadata.document_number).toBe("11222333000181");
    expect(body.metadata.company_name).toBe("Acme Ltda");
  });

  it("resumo mostra os rótulos, não os códigos, agrupado pelo passo de cada dado", () => {
    const sections = summarySections(filled());
    expect(sections.map((s) => [s.title, s.step])).toEqual([["Você", 1], ["Contato", 2], ["Documento", 3], ["Negócio", 4]]);
    const rows = Object.fromEntries(sections.flatMap((s) => s.rows).map((r) => [r.label, r.value]));
    expect(rows["O que vende"]).toBe("Curso / Infoproduto");
    expect(rows["Faturamento mensal"]).toBe("Até R$ 10 mil");
    expect(rows["Conheceu por"]).toBe("Instagram");
    expect(rows["CPF"]).toBe(VALID_CPF);
    expect(rows["WhatsApp"]).toBe("(11) 91234-5678");
    expect(rows["Razão social"]).toBeUndefined();
    const company = summarySections(filled({ accountType: "cnpj", document: VALID_CNPJ, companyName: "Acme" }));
    expect(company[2].rows.map((r) => r.label)).toEqual(["Razão social", "CNPJ"]);
    expect(company[0].rows[1].label).toBe("Responsável");
  });

  it("segundos restantes nunca ficam negativos", () => {
    expect(secondsLeft(10_500, 10_000)).toBe(1);
    expect(secondsLeft(15_000, 10_000)).toBe(5);
    expect(secondsLeft(9_000, 10_000)).toBe(0);
  });
});
