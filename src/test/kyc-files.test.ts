import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  MAX_KYC_BYTES, acceptsPdf, kycAccept, kycObjectName, prepareKycFile, uploadError, type Decoded, type PrepareDeps,
} from "@/features/kyc/kycFiles";
import { kycSubmitError } from "@/components/account/accountMeta";

const PDF_HEAD = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

/** Arquivo com tamanho falso (o conteúdo não importa: as dependências são simuladas). */
const fileOf = (name: string, type: string, size = 2000) => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

function deps(over: Partial<{ width: number; height: number; decodeFails: boolean; head: Uint8Array; blobSizes: number[] }> = {}) {
  const closed = vi.fn();
  const drawn: [number, number][] = [];
  const sizes = [...(over.blobSizes ?? [500_000])];
  const qualities: number[] = [];
  const d: PrepareDeps = {
    decode: vi.fn(async (): Promise<Decoded> => {
      if (over.decodeFails) throw new Error("decode");
      return { width: over.width ?? 2000, height: over.height ?? 1500, draw: (_c, w, h) => { drawn.push([w, h]); }, close: closed };
    }),
    encode: vi.fn(async (_c, q) => {
      qualities.push(q);
      const blob = new Blob(["y"], { type: "image/jpeg" });
      Object.defineProperty(blob, "size", { value: sizes.shift() ?? 500_000 });
      return blob;
    }),
    readHead: vi.fn(async () => over.head ?? PDF_HEAD),
  };
  return { d, closed, drawn, qualities };
}

describe("preparar arquivo da verificação", () => {
  it("recusa arquivo vazio e formato estranho", async () => {
    expect((await prepareKycFile(fileOf("a.jpg", "image/jpeg", 0), "front", deps().d)).error).toMatch(/vazio/);
    expect((await prepareKycFile(fileOf("a.docx", "application/msword"), "front", deps().d)).error).toBe("Formato não aceito. Envie uma foto (JPG, PNG ou WebP) ou um PDF.");
    expect((await prepareKycFile(fileOf("a.txt", "text/plain"), "selfie", deps().d)).error).toBe("Formato não aceito. Envie uma foto em JPG, PNG ou WebP.");
  });

  it("aceita PDF de verdade no documento e recusa na selfie", async () => {
    const ok = await prepareKycFile(fileOf("cnh.pdf", "application/pdf"), "front", deps().d);
    expect(ok.error).toBeNull();
    expect(ok.file?.type).toBe("application/pdf");
    // celular às vezes manda PDF sem tipo: o nome e o cabeçalho bastam
    const noType = await prepareKycFile(fileOf("cartao.PDF", ""), "cnpj_card", deps().d);
    expect(noType.file?.type).toBe("application/pdf");
    expect((await prepareKycFile(fileOf("s.pdf", "application/pdf"), "selfie", deps().d)).error).toMatch(/selfie precisa ser uma foto/);
  });

  it("recusa PDF falso e PDF grande demais", async () => {
    const fake = deps({ head: new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]) }); // "<html"
    expect((await prepareKycFile(fileOf("x.pdf", "application/pdf"), "front", fake.d)).error).toMatch(/não é um PDF válido/);
    expect((await prepareKycFile(fileOf("x.pdf", "application/pdf", MAX_KYC_BYTES + 1), "front", deps().d)).error).toMatch(/passa de 10 MB/);
  });

  it("foto boa e leve passa sem mexer", async () => {
    const { d, closed } = deps({ width: 1600, height: 1200 });
    const f = fileOf("doc.jpg", "image/jpeg", 900_000);
    const r = await prepareKycFile(f, "front", d);
    expect(r).toEqual({ file: f, error: null, changed: false });
    expect(d.encode).not.toHaveBeenCalled();
    expect(closed).toHaveBeenCalled();
  });

  it("foto pequena demais é recusada com as medidas", async () => {
    const r = await prepareKycFile(fileOf("doc.jpg", "image/jpeg"), "front", deps({ width: 600, height: 400 }).d);
    expect(r.error).toBe("A foto está pequena demais (600 × 400) para ler o documento. Tire de mais perto, com boa luz.");
  });

  it("foto enorme é reduzida para 3200 px e vira JPEG", async () => {
    const { d, drawn } = deps({ width: 6400, height: 4800 });
    const r = await prepareKycFile(fileOf("IMG_1.png", "image/png", 3_000_000), "selfie", d);
    expect(r.changed).toBe(true);
    expect(r.file?.name).toBe("IMG_1.jpg");
    expect(r.file?.type).toBe("image/jpeg");
    expect(drawn).toEqual([[3200, 2400]]);
  });

  it("foto pesada é recomprimida até caber, tentando qualidades menores", async () => {
    const { d, qualities } = deps({ width: 3000, height: 2000, blobSizes: [MAX_KYC_BYTES + 5, MAX_KYC_BYTES + 1, 4_000_000] });
    const r = await prepareKycFile(fileOf("big.jpg", "image/jpeg", 9_000_000), "front", d);
    expect(qualities).toEqual([0.9, 0.82, 0.72]);
    expect(r.error).toBeNull();
    const fail = deps({ width: 3000, height: 2000, blobSizes: [MAX_KYC_BYTES + 5, MAX_KYC_BYTES + 5, MAX_KYC_BYTES + 5] });
    expect((await prepareKycFile(fileOf("big.jpg", "image/jpeg", 9_000_000), "front", fail.d)).error).toMatch(/Não conseguimos reduzir/);
  });

  it("HEIC que o navegador abre é convertido; o que não abre explica o que fazer", async () => {
    const r = await prepareKycFile(fileOf("IMG_2.HEIC", "image/heic"), "back", deps({ width: 3024, height: 4032 }).d);
    expect(r.file?.type).toBe("image/jpeg");
    expect(r.changed).toBe(true);
    const no = await prepareKycFile(fileOf("IMG_3.heic", ""), "back", deps({ decodeFails: true }).d);
    expect(no.error).toMatch(/não abre fotos HEIC/);
    const broken = await prepareKycFile(fileOf("x.jpg", "image/jpeg"), "back", deps({ decodeFails: true }).d);
    expect(broken.error).toMatch(/Não conseguimos abrir essa imagem/);
  });
});

describe("nomes, campo de arquivo e erros", () => {
  it("o nome segue a regra do bucket", () => {
    expect(kycObjectName("cnpj_card", "application/pdf", "ab12cd34ef")).toBe("cnpj_card_ab12cd34ef.pdf");
    expect(kycObjectName("selfie", "image/heic", "ab12")).toBe("selfie_ab12.jpg");
    expect(kycObjectName("front", "image/png")).toMatch(/^front_[a-f0-9]{4,10}\.png$/i);
  });

  it("selfie não oferece PDF", () => {
    expect(acceptsPdf("selfie")).toBe(false);
    expect(kycAccept("selfie")).not.toContain("pdf");
    expect(kycAccept("cnpj_card")).toContain("application/pdf");
  });

  it("erros do envio em português", () => {
    expect(uploadError({ message: "new row violates row-level security policy" })).toMatch(/não podem ser trocados agora/);
    expect(uploadError({ message: "invalid_mime_type" })).toMatch(/Formato não aceito/);
    expect(uploadError({ message: "Payload too large", statusCode: 413 })).toMatch(/passa de 10 MB/);
    expect(uploadError({ message: "Failed to fetch" })).toMatch(/conexão/);
    expect(uploadError(null)).toMatch(/Tente de novo/);
  });

  it("erros do envio para análise dizem o que falta", () => {
    expect(kycSubmitError({ message: "missing_documents:back,selfie" })).toBe("Ainda falta enviar: documento (verso) e selfie com o documento.");
    expect(kycSubmitError({ message: "missing_documents:cnpj_card" })).toBe("Ainda falta enviar: cartão CNPJ.");
    expect(kycSubmitError({ message: "kyc_not_editable" })).toMatch(/já foi enviada ou concluída/);
    expect(kycSubmitError({ message: "kyc_unchanged" })).toMatch(/Troque o documento apontado na reprovação/);
    expect(kycSubmitError({ message: "not_authenticated" })).toMatch(/sessão expirou/);
  });
});
