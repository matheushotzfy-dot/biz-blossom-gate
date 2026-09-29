GRANT EXECUTE ON FUNCTION
  app_private.admin_list_refund_requests(text,int,int),
  app_private.admin_decide_refund(uuid,text,text,text),
  app_private.admin_set_manual_approval(jsonb),
  app_private.get_financial_metrics(timestamptz,timestamptz,uuid,uuid),
  app_private.get_acquirer_overview(timestamptz,timestamptz),
  app_private.get_seller_acquirer_history(uuid),
  app_private.request_staff_action(text,uuid,uuid,jsonb,text),
  app_private.admin_decide_staff_action(uuid,boolean,text),
  app_private.list_acquirers_basic()
TO authenticated;