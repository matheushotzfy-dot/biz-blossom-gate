import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Thumb, ToneTag } from "@/features/admin-products/parts";
import { cn } from "@/lib/utils";
import { courseAttention, courseState, dayLabel, durationLabel, productStateLabel, type CourseItem } from "./coursesModel";

const int = (v: number) => v.toLocaleString("pt-BR");

const Name = ({ c }: { c: CourseItem }) => (
  <div className="flex min-w-0 items-center gap-3">
    <Thumb url={c.thumbnail_url} name={c.title} icon={GraduationCap} />
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-foreground" title={c.title}>{c.title}</p>
      <p className="truncate text-[13px] text-muted-foreground">{c.category || "Sem categoria"}</p>
    </div>
  </div>
);

const Owner = ({ c }: { c: CourseItem }) => {
  const off = productStateLabel(c.product_id ? { status: c.product_status, deleted: c.product_deleted } : null);
  return (
    <div className="min-w-0">
      <p className="truncate text-[14px] text-foreground" title={c.seller_email ?? undefined}>{c.seller_name}</p>
      <p className="truncate text-[13px] text-muted-foreground" title={c.product_name ?? undefined}>
        {c.product_id ? `${c.product_name ?? "Produto"}${off ? ` (${off})` : ""}` : "Sem produto ligado"}
      </p>
    </div>
  );
};

function State({ c }: { c: CourseItem }) {
  const st = courseState(c);
  const att = courseAttention(c);
  return (
    <div className="space-y-1.5">
      <ToneTag tone={st.tone}>{st.label}</ToneTag>
      {att && <p className="max-w-[200px] text-[12.5px] font-medium text-warning">{att}</p>}
      {c.hold_reason && <p className="line-clamp-2 max-w-[220px] text-[12.5px] text-muted-foreground">Motivo: {c.hold_reason}</p>}
    </div>
  );
}

const Content = ({ c }: { c: CourseItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{int(c.lessons)} {c.lessons === 1 ? "aula" : "aulas"}</p>
    <p className="text-[12.5px] text-muted-foreground">{int(c.modules)} {c.modules === 1 ? "módulo" : "módulos"}{c.minutes > 0 ? ` · ${durationLabel(c.minutes)}` : ""}</p>
  </>
);

const Students = ({ c }: { c: CourseItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{int(c.students)} {c.students === 1 ? "aluno" : "alunos"}</p>
    <p className="text-[12.5px] text-muted-foreground">{c.certificates > 0 ? `${int(c.certificates)} ${c.certificates === 1 ? "certificado" : "certificados"}` : "sem certificados"}</p>
  </>
);

const Action = ({ c, onOpen }: { c: CourseItem; onOpen: (c: CourseItem) => void }) => (
  <Button type="button" size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => onOpen(c)} aria-label={`Ver ${c.title}`}>Ver detalhes</Button>
);

export function CoursesTable({ rows, onOpen }: { rows: CourseItem[]; onOpen: (c: CourseItem) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Curso", "Seller e produto", "Situação", "Conteúdo", "Alunos", ""].map((h, i) => <th key={h + i} className="whitespace-nowrap px-4 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className={cn("border-b border-border/40 align-middle last:border-b-0")}>
              <td className="max-w-[250px] px-4 py-3"><Name c={c} /></td>
              <td className="max-w-[220px] px-4 py-3"><Owner c={c} /></td>
              <td className="min-w-[150px] px-4 py-3"><State c={c} /></td>
              <td className="whitespace-nowrap px-4 py-3"><Content c={c} /></td>
              <td className="whitespace-nowrap px-4 py-3"><Students c={c} /></td>
              <td className="px-4 py-3 text-right"><Action c={c} onOpen={onOpen} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CoursesCards({ rows, onOpen }: { rows: CourseItem[]; onOpen: (c: CourseItem) => void }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((c) => (
        <li key={c.id} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <Name c={c} />
          <State c={c} />
          <Owner c={c} />
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 border-t border-border/40 pt-3">
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Conteúdo</dt><dd><Content c={c} /></dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Alunos</dt><dd><Students c={c} /></dd></div>
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] text-muted-foreground">Criado em {dayLabel(c.created_at)}</p>
            <Action c={c} onOpen={onOpen} />
          </div>
        </li>
      ))}
    </ul>
  );
}
