
-- 1. Mudar default de status para 'active' (produto novo já fica aprovado)
ALTER TABLE public.products ALTER COLUMN status SET DEFAULT 'active';

-- 2. Normalizar status legados ('blocked' e 'rejected' -> 'inactive')
UPDATE public.products SET status = 'inactive' WHERE status IN ('blocked', 'rejected');

-- 3. CHECK constraint para valores válidos
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_status_check
  CHECK (status IN ('draft', 'active', 'pending_review', 'inactive'));

-- 4. Trigger: notificar usuário quando admin muda status do produto
CREATE OR REPLACE FUNCTION public.notify_product_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _title text;
  _message text;
  _reason text;
BEGIN
  -- Só dispara se status mudou
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Não notifica transições envolvendo 'draft' (ainda em construção)
  IF NEW.status = 'draft' OR OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;

  _reason := COALESCE(NULLIF(trim(NEW.rejection_reason), ''), NULL);

  IF NEW.status = 'pending_review' THEN
    _title := 'Produto em revisão 🔍';
    _message := format('O seu produto "%s" entrou em revisão pela equipe.%s',
      NEW.name,
      CASE WHEN _reason IS NOT NULL THEN ' Motivo: ' || _reason ELSE '' END
    );
  ELSIF NEW.status = 'inactive' THEN
    _title := 'Produto inativado ⚠️';
    _message := format('O seu produto "%s" foi inativado pela equipe.%s',
      NEW.name,
      CASE WHEN _reason IS NOT NULL THEN ' Motivo: ' || _reason ELSE '' END
    );
  ELSIF NEW.status = 'active' AND OLD.status IN ('pending_review', 'inactive') THEN
    _title := 'Produto reaprovado ✅';
    _message := format('O seu produto "%s" foi reaprovado e está ativo novamente.', NEW.name);
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (NEW.user_id, _title, _message, 'product');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_product_status_change ON public.products;
CREATE TRIGGER trg_notify_product_status_change
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_product_status_change();
