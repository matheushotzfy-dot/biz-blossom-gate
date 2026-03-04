
-- Table for storing third-party app integrations
CREATE TABLE public.app_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  app_name text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  api_key text,
  api_url text,
  webhook_url text,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.app_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own integrations"
  ON public.app_integrations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all integrations"
  ON public.app_integrations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "deny_anon_all_app_integrations"
  ON public.app_integrations FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Updated at trigger
CREATE TRIGGER update_app_integrations_updated_at
  BEFORE UPDATE ON public.app_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
