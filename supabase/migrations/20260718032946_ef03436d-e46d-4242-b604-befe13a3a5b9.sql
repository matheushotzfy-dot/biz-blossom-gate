
-- Reconciliação manual: pagamento confirmado no PIX mas postback VeoPag não chegou.
UPDATE public.transactions
SET status = 'completed',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'manual_reconciliation', true,
      'manual_reconciliation_reason', 'PIX confirmado (MARIA CRISTINA DE CARVALHO PERES) sem postback VeoPag',
      'manual_reconciliation_at', now()
    )
WHERE id = '1923748e-782a-40df-ae98-9955070906f0'
  AND status = 'pending';

-- Registra evento de auditoria
INSERT INTO public.transaction_events (transaction_id, event_type, description, actor, acquirer_slug, visibility, metadata)
SELECT '1923748e-782a-40df-ae98-9955070906f0', 'manual_reconciliation',
       'Pagamento reconciliado manualmente — postback VeoPag não recebido',
       'admin', 'veopag', 'admin',
       jsonb_build_object('payer_name', 'MARIA CRISTINA DE CARVALHO PERES', 'amount', 102.89)
WHERE EXISTS (SELECT 1 FROM public.transactions WHERE id='1923748e-782a-40df-ae98-9955070906f0' AND status='completed');
