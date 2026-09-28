CREATE TABLE public.award_tiers (
  id text PRIMARY KEY,
  title text NOT NULL,
  tier text NOT NULL DEFAULT '',
  value numeric NOT NULL CHECK (value > 0),
  description text NOT NULL DEFAULT '',
  phrase text NOT NULL DEFAULT '',
  rewards text[] NOT NULL DEFAULT '{}',
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.award_tiers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.award_tiers TO authenticated;
GRANT ALL ON public.award_tiers TO service_role;
ALTER TABLE public.award_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view award tiers" ON public.award_tiers FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage award tiers" ON public.award_tiers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.award_tiers_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER award_tiers_touch BEFORE UPDATE ON public.award_tiers FOR EACH ROW EXECUTE FUNCTION public.award_tiers_touch();
INSERT INTO public.award_tiers (id,title,tier,value,sort_order,rewards) VALUES
('10k','Kit Pulseiras VENXPAY','Iniciante',10000,1,'{"Pulseira preta","Pulseira esmeralda"}'),
('100k','Placa 100 MIL','Bronze',100000,2,'{"Placa 100 MIL emoldurada"}'),
('250k','Placa 250 MIL','Prata',250000,3,'{"Placa 250 MIL iluminada"}'),
('500k','Placa 500 MIL','Elite',500000,4,'{"Placa 500 MIL","Acesso ao grupo VIP"}'),
('1m','Placa 1 MILHÃO','Milionário',1000000,5,'{"Placa 1 MILHÃO","VENXPAY Inner Circle"}'),
('5m','Placa 5 MILHÕES','Platina',5000000,6,'{"Placa em platina","Encontro privado"}'),
('10m','Placa 10 MILHÕES','Lenda',10000000,7,'{"Placa em ouro 24K","Hall of Fame","Premiação exclusiva"}');
ALTER PUBLICATION supabase_realtime ADD TABLE public.award_tiers;