
CREATE TABLE public.pix_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  key_type TEXT NOT NULL,
  key_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pix_keys_max_3 UNIQUE (user_id, key_value)
);

ALTER TABLE public.pix_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pix keys" ON public.pix_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pix keys" ON public.pix_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own pix keys" ON public.pix_keys FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all pix keys" ON public.pix_keys FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
