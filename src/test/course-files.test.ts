import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ createSignedUrl: vi.fn() }) } } }));

import { courseContentPathFromUrl, courseFilePath, COURSE_CONTENT_BUCKET } from "@/lib/courseFiles";

const BASE = "https://glccldyjevnmoogakqxw.supabase.co/storage/v1/object/public";

describe("courseContentPathFromUrl", () => {
  it("extrai o caminho de um arquivo do bucket de conteúdo", () => {
    expect(courseContentPathFromUrl(`${BASE}/${COURSE_CONTENT_BUCKET}/u1/c1/videos/a.mp4`)).toBe("u1/c1/videos/a.mp4");
  });

  it("ignora query e hash e decodifica o nome", () => {
    expect(courseContentPathFromUrl(`${BASE}/${COURSE_CONTENT_BUCKET}/u1/c1/attachments/Aula%201.pdf?download=1#x`)).toBe("u1/c1/attachments/Aula 1.pdf");
  });

  it("devolve null para link externo, vazio ou de outro bucket", () => {
    expect(courseContentPathFromUrl("https://www.youtube.com/watch?v=abc")).toBeNull();
    expect(courseContentPathFromUrl("")).toBeNull();
    expect(courseContentPathFromUrl(null)).toBeNull();
    expect(courseContentPathFromUrl(`${BASE}/product-images/u1/foto.png`)).toBeNull();
  });
});

describe("courseFilePath", () => {
  it("segue o padrão {dono}/{curso}/{tipo}/{uuid}.{ext} exigido pela política do storage", () => {
    expect(courseFilePath("owner", "course", "videos", "MP4")).toMatch(/^owner\/course\/videos\/[0-9a-f-]{36}\.mp4$/);
  });

  it("limpa a extensão e cai em .bin quando ela some", () => {
    expect(courseFilePath("o", "c", "attachments", "p.d/f!")).toMatch(/\.pdf$/);
    expect(courseFilePath("o", "c", "attachments", "###")).toMatch(/\.bin$/);
  });

  it("gera um nome diferente a cada chamada", () => {
    expect(courseFilePath("o", "c", "videos", "mp4")).not.toBe(courseFilePath("o", "c", "videos", "mp4"));
  });
});
