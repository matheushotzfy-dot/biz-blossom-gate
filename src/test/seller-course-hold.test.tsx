import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContentCourseCard } from "@/components/course/ContentCourseCard";
import { ContentCourseRow } from "@/components/course/ContentCourseRow";
import type { ContentCourse } from "@/components/course/contentPresentation";

const base: ContentCourse = {
  id: "c1", title: "Método Lançamento 7D", description: "Passo a passo completo.", category: null, thumbnail_url: null, product_id: "p1",
  is_published: true, sort_order: 0, user_id: "u1", created_at: "2026-11-01T12:00:00Z",
};
const handlers = { onOpenBuilder: vi.fn(), onOpenEdit: vi.fn(), onOpenAnalytics: vi.fn(), onTogglePublish: vi.fn(), onCopyLink: vi.fn(), onOpenPreview: vi.fn(), onDelete: vi.fn() };
const props = (course: ContentCourse) => ({ course, stats: { modules: 2, lessons: 9 }, productName: "Método", students: 12, revenue: 1500, copied: false, ...handlers });

describe("área de membros tirada do ar pela equipe (visão do seller)", () => {
  it("cartão: mostra o aviso com o motivo e não finge que está publicada", () => {
    render(<ContentCourseCard {...props({ ...base, is_published: false, admin_hold_at: "2026-11-24T10:00:00Z", admin_hold_reason: "Promessa irreal de resultado" })} />);
    expect(screen.getByText("Tirada do ar")).toBeInTheDocument();
    expect(screen.queryByText("Publicada")).toBeNull();
    expect(screen.getByText(/A equipe tirou do ar: Promessa irreal de resultado/)).toBeInTheDocument();
    expect(screen.getByText(/Fale com o suporte para voltar a publicar/)).toBeInTheDocument();
    expect(screen.queryByText("Passo a passo completo.")).toBeNull();
    // sem link público: não oferece copiar nem ver como aluno
    expect(screen.queryByLabelText("Copiar link da área")).toBeNull();
  });

  it("linha da lista: mesma situação, texto curto", () => {
    render(<ul><ContentCourseRow {...props({ ...base, is_published: false, admin_hold_at: "2026-11-24T10:00:00Z", admin_hold_reason: "Direitos autorais" })} /></ul>);
    expect(screen.getByText("Tirada do ar")).toBeInTheDocument();
    expect(screen.getByText("A equipe tirou do ar: Direitos autorais")).toBeInTheDocument();
  });

  it("sem motivo registrado ainda avisa, sem 'null' na tela", () => {
    render(<ContentCourseCard {...props({ ...base, is_published: false, admin_hold_at: "2026-11-24T10:00:00Z", admin_hold_reason: null })} />);
    expect(screen.getByText(/A equipe tirou do ar\. Fale com o suporte/)).toBeInTheDocument();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it("curso normal não muda: publicada e rascunho continuam iguais", () => {
    const { unmount } = render(<ContentCourseCard {...props(base)} />);
    expect(screen.getByText("Publicada")).toBeInTheDocument();
    expect(screen.getByText("Passo a passo completo.")).toBeInTheDocument();
    unmount();
    render(<ContentCourseCard {...props({ ...base, is_published: false })} />);
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.queryByText(/A equipe tirou/)).toBeNull();
  });
});
