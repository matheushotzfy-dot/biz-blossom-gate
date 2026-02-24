
-- Create activity_logs table for tracking all user actions
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can see all logs
CREATE POLICY "Admins can view all activity logs"
  ON public.activity_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view own logs
CREATE POLICY "Users can view own activity logs"
  ON public.activity_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger function to log product changes automatically
CREATE OR REPLACE FUNCTION public.log_product_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.user_id, 'product_created', 'product', NEW.id::text,
      jsonb_build_object('name', NEW.name, 'price', NEW.price, 'description', NEW.description, 'status', NEW.status, 'image_url', NEW.image_url, 'checkout_url', NEW.checkout_url));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (OLD.user_id, 'product_updated', 'product', OLD.id::text,
      jsonb_build_object('name', OLD.name, 'price', OLD.price, 'description', OLD.description, 'status', OLD.status, 'image_url', OLD.image_url),
      jsonb_build_object('name', NEW.name, 'price', NEW.price, 'description', NEW.description, 'status', NEW.status, 'image_url', NEW.image_url));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, old_data)
    VALUES (OLD.user_id, 'product_deleted', 'product', OLD.id::text,
      jsonb_build_object('name', OLD.name, 'price', OLD.price, 'description', OLD.description, 'status', OLD.status, 'image_url', OLD.image_url, 'checkout_url', OLD.checkout_url));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach trigger to products table
CREATE TRIGGER trg_log_product_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_changes();

-- Also log course changes
CREATE OR REPLACE FUNCTION public.log_course_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.user_id, 'course_created', 'course', NEW.id::text,
      jsonb_build_object('title', NEW.title, 'description', NEW.description, 'is_published', NEW.is_published));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (OLD.user_id, 'course_updated', 'course', OLD.id::text,
      jsonb_build_object('title', OLD.title, 'is_published', OLD.is_published),
      jsonb_build_object('title', NEW.title, 'is_published', NEW.is_published));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, old_data)
    VALUES (OLD.user_id, 'course_deleted', 'course', OLD.id::text,
      jsonb_build_object('title', OLD.title, 'description', OLD.description));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_log_course_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.log_course_changes();

-- Index for fast lookups
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs(created_at DESC);
