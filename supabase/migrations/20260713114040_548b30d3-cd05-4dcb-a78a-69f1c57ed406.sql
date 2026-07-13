
INSERT INTO public.acquirers (name, slug, type, is_active, seller_visible, api_endpoint, description, priority, allow_failover, supported_methods, api_environment, notes)
VALUES (
  'VeoPag', 'veopag', 'black', true, false,
  'https://api.veopag.com',
  'Gateway PIX (integração de testes com vendas reais).',
  10, false, ARRAY['pix'], 'production',
  'Anonimização obrigatória: nunca enviar nome/email da plataforma; email do pagador é aleatório.'
)
ON CONFLICT (slug) DO UPDATE
  SET is_active = EXCLUDED.is_active,
      api_endpoint = EXCLUDED.api_endpoint,
      description = EXCLUDED.description,
      notes = EXCLUDED.notes;
