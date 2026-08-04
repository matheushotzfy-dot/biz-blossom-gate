DO $$
DECLARE
  f record;
  -- funções que NINGUÉM (anon/authenticated/PUBLIC) deve executar via API
  internal_fns text[] := ARRAY[
    'log_transaction_event','compute_acquirer_fee','check_auto_withdrawal',
    'sync_ticket_on_message','tx_events_auto_log'
  ];
  -- funções restritas a usuários autenticados
  auth_fns text[] := ARRAY[
    'admin_set_acquirer_active','admin_set_seller_acquirer',
    'race_leaderboard','get_goal_progress','get_my_goal_progress','has_support_access'
  ];
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname = ANY(internal_fns || auth_fns)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    IF f.proname = ANY(auth_fns) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;