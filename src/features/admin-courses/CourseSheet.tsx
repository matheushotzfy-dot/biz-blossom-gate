import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { dateLabel } from "@/features/admin-disputes/disputesModel";
import { Info } from "@/features/admin-disputes/parts";
import { Block, Figure, Thumb, ToneTag } from "@/features/admin-products/parts";
import { courseContentPathFromUrl, signCourseFile } from "@/lib/courseFiles";
import { friendlyError } from "@/lib/friendlyError";
import { openExternal } from "@/lib/safeUrl";
import { cn } from "@/lib/utils";
import { HoldDialog, type HoldTarget } from "./HoldDialog";
import { courseAttention, courseState, durationLabel, historyLabel, parseCourseDetail, productStateLabel, videoKind, type CourseDetail, type CourseItem } from "./coursesModel";

/** Abre o vídeo da aula: link externo direto; arquivo enviado com link assinado e temporário. */
async function openLesson(url: string) {
  if (!courseContentPathFromUrl(url)) {
    if (!openExternal(url)) toast.error("Esse link de vídeo não é válido.");
    return;
  }
  // a janela abre já no clique, senão o navegador bloqueia o pop-up depois de esperar o link assinado
  const w = window.open("", "_blank");
  try {
    const signed = await signCourseFile(url, { expiresIn: 600 });
    if (w) { w.opener = null; w.location.href = signed; } else openExternal(signed);
  } catch {
    w?.close();
    toast.error("Não foi possível abrir o vídeo. Tente de novo.");
  }
}

/** Raio-X do curso: o que o admin precisa ver para decidir, e a ação de tirar do ar ou liberar. */
export function CourseSheet({ id, seed, onClose }: { id: string | null; seed: CourseItem | null; onClose: () => void }) {
  // guarda o último curso para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<{ id: string; seed: CourseItem | null } | null>(id ? { id, seed } : null);
  useEffect(() => { if (id) setLast({ id, seed }); }, [id, seed]);
  const cur = id ? { id, seed } : last;
  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("xl")}>{cur && <SheetBody key={cur.id} id={cur.id} seed={cur.seed} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function SheetBody({ id, seed, onClose }: { id: string; seed: CourseItem | null; onClose: () => void }) {
  const [hold, setHold] = useState<HoldTarget | null>(null);
  const q = useQuery({
    queryKey: ["admin-course-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_course_detail" as never, { _id: id } as never);
      if (error) throw error;
      return parseCourseDetail(data);
    },
  });
  const d = q.data;
  const head = d?.course ?? seed;
  const st = head ? courseState(head) : null;
  const sellerName = d?.seller.name ?? seed?.seller_name ?? "Seller";
  const held = !!d?.course.hold_at;
  const start = (h: boolean) => { if (d) setHold({ course: { id: d.course.id, title: d.course.title, seller_name: sellerName, is_published: d.course.is_published }, hold: h }); };

  return (
    <>
      <DialogHead icon={<GraduationCap className="h-5 w-5" />} title={head?.title ?? "Curso"} subtitle={`${sellerName}${head?.created_at ? ` · criado em ${dateLabel(head.created_at)}` : ""}`}
        aside={st ? <ToneTag tone={st.tone}>{st.label}</ToneTag> : undefined} />
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogBody>
          {q.isPending ? <p className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o raio-X do curso…</p>
            : q.isError || !d ? (
              <p role="alert" className="py-6 text-[14px] font-medium text-destructive">
                {friendlyError(q.error, "Não foi possível carregar o curso.")} <button type="button" className="underline" onClick={() => void q.refetch()}>Tentar de novo</button>
              </p>
            ) : <Detail d={d} />}
        </DialogBody>
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Fechar</button>
          {d && !held && <button type="button" onClick={() => start(true)} className={cn("vp-ghost !h-12 justify-center !text-destructive")}>Tirar do ar</button>}
          {d && held && <button type="button" onClick={() => start(false)} className="vp-cta !h-12 justify-center sm:min-w-[150px]">Liberar curso</button>}
        </DialogFoot>
      </div>
      <HoldDialog target={hold} onClose={() => setHold(null)} />
    </>
  );
}

function Detail({ d }: { d: CourseDetail }) {
  const { course: c, seller: s, stats: x, product: p } = d;
  const productOff = productStateLabel(p ? { status: p.status, deleted: p.deleted } : null);
  const attention = courseAttention({ is_published: c.is_published, lessons: x.lessons, product_id: p?.id ?? null, product_status: p?.status ?? null, product_deleted: p?.deleted ?? false, hold_at: c.hold_at });

  return (
    <>
      {c.hold_at && (
        <div className="rounded-[14px] bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
          <p className="font-semibold">Tirado do ar em {dateLabel(c.hold_at)}. O seller não consegue publicar de novo.</p>
          {c.hold_reason && <p className="mt-0.5 whitespace-pre-wrap break-words font-medium">Motivo: {c.hold_reason}</p>}
        </div>
      )}
      {attention && <p className="rounded-[14px] bg-warning/10 px-4 py-3 text-[14px] font-medium text-warning">{attention}: {x.lessons === 0 ? "o aluno entra e não encontra nada para assistir." : "o aluno que comprou pode ficar sem acesso ao que pagou."}</p>}

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="hidden shrink-0 self-start sm:block"><Thumb url={c.thumbnail_url} name={c.title} size={112} icon={GraduationCap} /></div>
        <div className="min-w-0 flex-1 space-y-3">
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-6 gap-y-3">
            <Info label="Categoria">{c.category || "Sem categoria"}</Info>
            <Info label="Atualizado em">{c.updated_at ? dateLabel(c.updated_at) : "—"}</Info>
          </dl>
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">Descrição</p>
            {c.description.trim()
              ? <p className="mt-0.5 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground/90">{c.description}</p>
              : <p className="mt-0.5 text-[14px] text-muted-foreground">O seller não escreveu descrição.</p>}
          </div>
        </div>
      </div>

      <Block title="Seller e produto">
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          <Info label="Seller">{s.name}</Info>
          <Info label="E-mail">{s.email ?? "—"}</Info>
          <Info label="Produto ligado">{p ? `${p.name}${productOff ? ` (${productOff})` : ""}` : "Nenhum: curso solto, sem venda ligada"}</Info>
        </dl>
      </Block>

      <Block title="Alunos" aside="quem comprou e já abriu o curso">
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 md:grid-cols-[repeat(3,minmax(0,1fr))]">
          <Figure label="Com acesso" value={x.students.toLocaleString("pt-BR")} sub={x.revoked > 0 ? `${x.revoked} com acesso retirado` : undefined} />
          <Figure label="Já assistiram algo" value={x.with_progress.toLocaleString("pt-BR")} sub={`${x.active_7d.toLocaleString("pt-BR")} nos últimos 7 dias`} />
          <Figure label="Certificados" value={x.certificates.toLocaleString("pt-BR")} sub={`${x.comments.toLocaleString("pt-BR")} ${x.comments === 1 ? "comentário" : "comentários"} nas aulas`} />
        </div>
      </Block>

      <Block title="Conteúdo" aside={`${x.modules} ${x.modules === 1 ? "módulo" : "módulos"} · ${x.lessons} ${x.lessons === 1 ? "aula" : "aulas"} · ${durationLabel(x.minutes)}`}>
        {d.modules.length === 0 ? <p className="text-[13.5px] text-muted-foreground">O seller ainda não criou nenhum módulo.</p> : (
          <div className="space-y-3">
            {d.modules.map((m) => (
              <section key={m.id} className="overflow-hidden rounded-[14px] bg-muted/30">
                <h4 className="px-4 py-2.5 text-[13.5px] font-semibold text-foreground">{m.title}</h4>
                {m.lessons.length === 0 ? <p className="border-t border-border/50 px-4 py-2.5 text-[13px] text-muted-foreground">Módulo sem aulas.</p> : (
                  <ul className="divide-y divide-border/50 border-t border-border/50">
                    {m.lessons.map((l) => {
                      const v = videoKind(l.video_url);
                      return (
                        <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-[14px]">
                          <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={l.title}>{l.title}</span>
                          <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                            {l.is_free && <ToneTag tone="info">Aula grátis</ToneTag>}
                            {l.attachments > 0 && <span>{l.attachments} {l.attachments === 1 ? "material" : "materiais"}</span>}
                            {l.minutes > 0 && <span>{durationLabel(l.minutes)}</span>}
                            <span className={cn(v.kind === "none" && "text-warning")}>{v.label}</span>
                            {l.video_url && v.label !== "Link inválido" && (
                              <button type="button" onClick={() => void openLesson(l.video_url!)} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" aria-label={`Abrir o vídeo de ${l.title}`}>
                                <PlayCircle className="h-4 w-4" /> Abrir
                              </button>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
        {x.without_video > 0 && <p className="mt-2 text-[12.5px] text-muted-foreground">{x.without_video} {x.without_video === 1 ? "aula sem vídeo" : "aulas sem vídeo"}; podem ser só texto ou material.</p>}
      </Block>

      <Block title="Histórico do curso">
        {d.history.length === 0 ? <p className="text-[13.5px] text-muted-foreground">Nenhuma ação da equipe registrada.</p> : (
          <ol className="space-y-3 border-l border-border pl-4">
            {d.history.map((h) => (
              <li key={h.id} className="relative">
                <span aria-hidden className="absolute -left-[21px] top-[7px] h-2 w-2 rounded-full bg-primary" />
                <p className="text-[13.5px] font-semibold text-foreground">{historyLabel(h.action)}</p>
                <p className="text-[12.5px] text-muted-foreground">{dateLabel(h.created_at)}{h.admin_name ? ` · ${h.admin_name}` : ""}</p>
                {h.reason && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] text-foreground/85">{h.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </Block>
    </>
  );
}
