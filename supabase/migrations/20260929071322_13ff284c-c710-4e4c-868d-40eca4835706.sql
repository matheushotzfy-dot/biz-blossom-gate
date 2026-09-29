CREATE OR REPLACE FUNCTION app_private.request_staff_action(_kind text, _target_seller uuid, _target_acquirer uuid, _payload jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _u uuid := auth.uid(); _role text; _id uuid; _recent int; _seller uuid := _target_seller; _email text := lower(btrim(COALESCE(_payload->>'seller_email','')));
BEGIN
  IF _u IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT role::text INTO _role FROM public.user_roles WHERE user_id = _u AND role::text IN ('partner','manager') ORDER BY role::text = 'partner' DESC LIMIT 1;
  IF _role IS NULL OR NOT app_private.has_financial_permission(_u,'request_actions') THEN RAISE EXCEPTION 'sem permissão para enviar pedidos'; END IF;
  IF _kind NOT IN ('acquirer_change','acquirer_toggle','fee_change','seller_freeze','platform_setting','other') THEN RAISE EXCEPTION 'tipo inválido'; END IF;
  SELECT count(*) INTO _recent FROM public.staff_action_requests WHERE requested_by = _u AND created_at > now() - interval '1 hour';
  IF _recent >= 30 THEN RAISE EXCEPTION 'muitos pedidos em sequência'; END IF;
  IF _seller IS NULL AND _email <> '' THEN
    SELECT user_id INTO _seller FROM public.profiles WHERE lower(email) = _email LIMIT 1;
    IF _seller IS NULL THEN RAISE EXCEPTION 'seller não encontrado'; END IF;
  END IF;
  IF _kind IN ('acquirer_change','seller_freeze') AND _seller IS NULL THEN RAISE EXCEPTION 'informe o seller'; END IF;
  IF _kind IN ('acquirer_change','acquirer_toggle') AND (_target_acquirer IS NULL OR NOT EXISTS (SELECT 1 FROM public.acquirers WHERE id = _target_acquirer)) THEN RAISE EXCEPTION 'adquirente inválida'; END IF;
  INSERT INTO public.staff_action_requests(kind,target_seller_id,target_acquirer_id,payload,reason,requested_by,requested_role)
  VALUES (_kind,_seller,_target_acquirer,jsonb_build_object('seller_email',NULLIF(_email,''),'active',_payload->'active'),btrim(_reason),_u,_role) RETURNING id INTO _id;
  INSERT INTO public.admin_alerts(kind,severity,message,metadata) VALUES ('staff_request','warning','Novo pedido da equipe aguardando aprovação', jsonb_build_object('request_id',_id,'kind',_kind,'role',_role));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION app_private.request_staff_action(text,uuid,uuid,jsonb,text) FROM PUBLIC, anon;