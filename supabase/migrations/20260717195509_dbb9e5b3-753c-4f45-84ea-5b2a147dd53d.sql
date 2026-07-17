DROP POLICY IF EXISTS race_overrides_read_all ON public.revenue_race_overrides;
CREATE POLICY race_overrides_read_authenticated ON public.revenue_race_overrides FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.revenue_race_overrides FROM anon;