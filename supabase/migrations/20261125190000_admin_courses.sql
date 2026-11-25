-- Admin › Cursos
--  • ANTES: a aba só listava `courses` direto do navegador (50 por página, nomes de seller e produto vindos de listas
--    limitadas do painel, que viravam "abc123…" quando o seller não estava carregado) e não dava nada para fazer.
--  • AGORA: lista paginada no servidor (seller, produto, módulos, aulas, alunos, certificados), raio-X do curso em
--    uma chamada e "Tirar do ar": o curso sai da área do aluno na hora e o seller NÃO consegue republicar sozinho
--    (gatilho), até o admin liberar. Ação com motivo, senha recente, auditoria e aviso ao seller.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS admin_hold_reason text,
  ADD COLUMN IF NOT EXISTS admin_hold_at timestamptz;

-- Quem não é admin (nem service_role) não mexe na retenção e não republica curso retido.
CREATE OR REPLACE FUNCTION app_private.guard_courses_admin_hold()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.admin_hold_reason := NULL; NEW.admin_hold_at := NULL;
    RETURN NEW;
  END IF;
  NEW.admin_hold_reason := OLD.admin_hold_reason;
  NEW.admin_hold_at := OLD.admin_hold_at;
  IF OLD.admin_hold_at IS NOT NULL AND COALESCE(NEW.is_published, false) THEN
    RAISE EXCEPTION 'A equipe tirou este curso do ar e ele só volta com a liberação do suporte.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS guard_courses_admin_hold ON public.courses;
CREATE TRIGGER guard_courses_admin_hold BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_courses_admin_hold();

-- ───────────────────────── lista ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_courses_page(
  _status text DEFAULT 'all', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text := COALESCE(NULLIF(btrim(COALESCE(_status, '')), ''), 'all');
  v_q      text := NULLIF(btrim(COALESCE(_search, '')), '');
  v_pat    text;
  v_ps     int  := LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_off    int  := (GREATEST(COALESCE(_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(_page_size, 25), 1), 100);
  v_out    jsonb;
BEGIN
  PERFORM app_private.assert_admin();
  IF v_status NOT IN ('all', 'published', 'draft', 'held') THEN RAISE EXCEPTION 'filtro inválido'; END IF;
  IF v_q IS NOT NULL THEN
    IF length(v_q) > 120 THEN RAISE EXCEPTION 'busca muito longa'; END IF;
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH base AS (
    SELECT c.*, p.name AS product_name, p.status AS product_status, (p.deleted_at IS NOT NULL) AS product_deleted,
           pr.full_name AS seller_name, pr.email AS seller_email
      FROM public.courses c
      LEFT JOIN public.products p ON p.id = c.product_id
      LEFT JOIN public.profiles pr ON pr.user_id = c.user_id
     WHERE v_q IS NULL OR c.title ILIKE v_pat OR COALESCE(c.category, '') ILIKE v_pat OR COALESCE(p.name, '') ILIKE v_pat
        OR COALESCE(pr.full_name, '') ILIKE v_pat OR COALESCE(pr.email, '') ILIKE v_pat OR c.id::text ILIKE v_pat
  ),
  filt AS (
    SELECT * FROM base
     WHERE v_status = 'all'
        OR (v_status = 'published' AND is_published)
        OR (v_status = 'draft' AND NOT is_published AND admin_hold_at IS NULL)
        OR (v_status = 'held' AND admin_hold_at IS NOT NULL)
  ),
  paged AS (
    SELECT f.*, row_number() OVER (ORDER BY (f.admin_hold_at IS NOT NULL) DESC, f.is_published DESC, f.created_at DESC, f.id) AS rn
      FROM filt f
  ),
  page AS (SELECT * FROM paged WHERE rn > v_off AND rn <= v_off + v_ps),
  mods AS (
    SELECT m.course_id, count(DISTINCT m.id) AS modules, count(l.id) AS lessons, COALESCE(sum(l.duration_minutes), 0) AS minutes
      FROM public.modules m LEFT JOIN public.lessons l ON l.module_id = m.id
     WHERE m.course_id IN (SELECT id FROM page) GROUP BY m.course_id
  ),
  acc AS (
    SELECT course_id, count(*) FILTER (WHERE status = 'active') AS students
      FROM public.user_access WHERE course_id IN (SELECT id FROM page) GROUP BY course_id
  ),
  cert AS (
    SELECT course_id, count(*) AS certificates FROM public.certificates WHERE course_id IN (SELECT id FROM page) GROUP BY course_id
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'category', p.category, 'thumbnail_url', p.thumbnail_url, 'is_published', p.is_published,
        'hold_reason', p.admin_hold_reason, 'hold_at', p.admin_hold_at, 'created_at', p.created_at, 'updated_at', p.updated_at,
        'product_id', p.product_id, 'product_name', p.product_name, 'product_status', p.product_status, 'product_deleted', COALESCE(p.product_deleted, false),
        'seller_user_id', p.user_id, 'seller_name', p.seller_name, 'seller_email', p.seller_email,
        'modules', COALESCE(m.modules, 0), 'lessons', COALESCE(m.lessons, 0), 'minutes', COALESCE(m.minutes, 0),
        'students', COALESCE(a.students, 0), 'certificates', COALESCE(c.certificates, 0)
      ) ORDER BY p.rn)
      FROM page p LEFT JOIN mods m ON m.course_id = p.id LEFT JOIN acc a ON a.course_id = p.id LEFT JOIN cert c ON c.course_id = p.id), '[]'::jsonb),
    'total', (SELECT count(*) FROM filt),
    'summary', (SELECT jsonb_build_object(
        'all', count(*), 'published', count(*) FILTER (WHERE is_published),
        'draft', count(*) FILTER (WHERE NOT is_published AND admin_hold_at IS NULL),
        'held', count(*) FILTER (WHERE admin_hold_at IS NOT NULL),
        -- no ar sem nenhuma aula, ou com produto fora do ar: o aluno entra e não vê o que comprou
        'published_empty', count(*) FILTER (WHERE is_published AND NOT EXISTS (SELECT 1 FROM public.modules mm JOIN public.lessons ll ON ll.module_id = mm.id WHERE mm.course_id = base.id)),
        'published_product_off', count(*) FILTER (WHERE is_published AND product_id IS NOT NULL AND (product_deleted OR COALESCE(product_status, '') <> 'active'))
      ) FROM base),
    'generated_at', now())
  INTO v_out;
  RETURN v_out;
END
$function$;

-- ───────────────────────── raio-X ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.get_admin_course_detail(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _c public.courses%ROWTYPE;
  _p public.products%ROWTYPE;
  _pr public.profiles%ROWTYPE;
BEGIN
  PERFORM app_private.assert_admin();
  SELECT * INTO _c FROM public.courses WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'curso não encontrado'; END IF;
  SELECT * INTO _p FROM public.products WHERE id = _c.product_id;
  SELECT * INTO _pr FROM public.profiles WHERE user_id = _c.user_id;

  RETURN jsonb_build_object(
    'course', jsonb_build_object(
      'id', _c.id, 'title', _c.title, 'description', left(COALESCE(_c.description, ''), 600), 'category', _c.category, 'thumbnail_url', _c.thumbnail_url,
      'is_published', _c.is_published, 'hold_reason', _c.admin_hold_reason, 'hold_at', _c.admin_hold_at, 'created_at', _c.created_at, 'updated_at', _c.updated_at),
    'product', CASE WHEN _p.id IS NULL THEN NULL ELSE jsonb_build_object('id', _p.id, 'name', _p.name, 'status', _p.status, 'deleted', _p.deleted_at IS NOT NULL) END,
    'seller', jsonb_build_object('user_id', _c.user_id, 'name', COALESCE(NULLIF(_pr.full_name, ''), _pr.email, 'Seller sem nome'), 'email', _pr.email, 'account_status', _pr.account_status),
    'stats', jsonb_build_object(
      'modules', (SELECT count(*) FROM public.modules WHERE course_id = _id),
      'lessons', (SELECT count(*) FROM public.lessons l JOIN public.modules m ON m.id = l.module_id WHERE m.course_id = _id),
      'minutes', (SELECT COALESCE(sum(l.duration_minutes), 0) FROM public.lessons l JOIN public.modules m ON m.id = l.module_id WHERE m.course_id = _id),
      'free_lessons', (SELECT count(*) FROM public.lessons l JOIN public.modules m ON m.id = l.module_id WHERE m.course_id = _id AND l.is_free),
      'without_video', (SELECT count(*) FROM public.lessons l JOIN public.modules m ON m.id = l.module_id WHERE m.course_id = _id AND COALESCE(btrim(l.video_url), '') = ''),
      'students', (SELECT count(*) FROM public.user_access WHERE course_id = _id AND status = 'active'),
      'revoked', (SELECT count(*) FROM public.user_access WHERE course_id = _id AND status <> 'active'),
      'with_progress', (SELECT count(DISTINCT up.user_id) FROM public.user_progress up JOIN public.lessons l ON l.id = up.lesson_id JOIN public.modules m ON m.id = l.module_id WHERE m.course_id = _id),
      'active_7d', (SELECT count(DISTINCT up.user_id) FROM public.user_progress up JOIN public.lessons l ON l.id = up.lesson_id JOIN public.modules m ON m.id = l.module_id WHERE m.course_id = _id AND up.updated_at > now() - interval '7 days'),
      'certificates', (SELECT count(*) FROM public.certificates WHERE course_id = _id),
      'comments', (SELECT count(*) FROM public.lesson_comments lc JOIN public.lessons l ON l.id = lc.lesson_id JOIN public.modules m ON m.id = l.module_id WHERE m.course_id = _id)),
    'modules', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title,
        'lessons', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id', l.id, 'title', l.title, 'minutes', l.duration_minutes, 'is_free', l.is_free, 'video_url', NULLIF(btrim(COALESCE(l.video_url, '')), ''),
            'attachments', (SELECT count(*) FROM public.lesson_attachments la WHERE la.lesson_id = l.id)
          ) ORDER BY l.sort_order, l.created_at) FROM public.lessons l WHERE l.module_id = m.id), '[]'::jsonb)
      ) ORDER BY m.sort_order, m.created_at)
      FROM public.modules m WHERE m.course_id = _id), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(h ORDER BY h.created_at DESC) FROM (
        SELECT a.id, a.action, a.created_at, a.details, NULLIF(COALESCE(ap.full_name, ap.email), '') AS admin_name
          FROM public.audit_logs a LEFT JOIN public.profiles ap ON ap.user_id = a.admin_user_id
         WHERE a.entity_type = 'course' AND a.entity_id = _id::text
         ORDER BY a.created_at DESC LIMIT 20) h), '[]'::jsonb)
  );
END
$function$;

-- ───────────────────────── tirar do ar / liberar ─────────────────────────

CREATE OR REPLACE FUNCTION app_private.admin_set_course_hold(_id uuid, _hold boolean, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := app_private.assert_admin();
  _c public.courses%ROWTYPE;
  _r text := left(regexp_replace(COALESCE(btrim(_reason), ''), '[<>]', '', 'g'), 1000);
BEGIN
  IF _hold IS NULL THEN RAISE EXCEPTION 'ação inválida'; END IF;
  IF length(_r) < 5 THEN RAISE EXCEPTION 'explique o motivo (mínimo 5 caracteres)'; END IF;
  SELECT * INTO _c FROM public.courses WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'curso não encontrado'; END IF;

  IF _hold THEN
    IF _c.admin_hold_at IS NOT NULL THEN RAISE EXCEPTION 'o curso já está tirado do ar pela equipe'; END IF;
    UPDATE public.courses SET is_published = false, admin_hold_reason = _r, admin_hold_at = now() WHERE id = _id;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_c.user_id, 'Curso tirado do ar', format('A equipe tirou o curso "%s" do ar. Motivo: %s', _c.title, _r), 'course');
    PERFORM app_private.admin_audit(_admin, 'course_hold', 'course', _id::text,
      jsonb_build_object('reason', _r, 'was_published', _c.is_published, 'seller', _c.user_id, 'title', _c.title));
  ELSE
    IF _c.admin_hold_at IS NULL THEN RAISE EXCEPTION 'o curso não está tirado do ar'; END IF;
    UPDATE public.courses SET admin_hold_reason = NULL, admin_hold_at = NULL WHERE id = _id;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (_c.user_id, 'Curso liberado', format('O curso "%s" foi liberado. Publique de novo quando quiser.', _c.title), 'course');
    PERFORM app_private.admin_audit(_admin, 'course_release', 'course', _id::text,
      jsonb_build_object('reason', _r, 'previous_reason', _c.admin_hold_reason, 'seller', _c.user_id, 'title', _c.title));
  END IF;
  RETURN jsonb_build_object('id', _id, 'held', _hold);
END
$function$;

-- ───────────────────────── wrappers públicos e permissões ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_courses_page(_status text DEFAULT 'all', _search text DEFAULT NULL, _page integer DEFAULT 1, _page_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_courses_page(_status, _search, _page, _page_size); $$;

CREATE OR REPLACE FUNCTION public.get_admin_course_detail(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public', 'app_private'
AS $$ SELECT app_private.get_admin_course_detail(_id); $$;

CREATE OR REPLACE FUNCTION public.admin_set_course_hold(_id uuid, _hold boolean, _reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public', 'app_private'
AS $function$ BEGIN PERFORM app_private.assert_recent_auth(); RETURN app_private.admin_set_course_hold(_id, _hold, _reason); END $function$;

REVOKE ALL ON FUNCTION app_private.get_admin_courses_page(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.get_admin_course_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.admin_set_course_hold(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_courses_page(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_course_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_course_hold(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_courses_page(text, text, integer, integer), app_private.get_admin_course_detail(uuid), app_private.admin_set_course_hold(uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_courses_page(text, text, integer, integer), public.get_admin_course_detail(uuid), public.admin_set_course_hold(uuid, boolean, text) TO authenticated, service_role;
