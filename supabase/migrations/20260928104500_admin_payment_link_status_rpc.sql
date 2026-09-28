-- Admin-only RPC to update moderation status of a payment link.
-- payment_links only has owner_* RLS policies for UPDATE, so a normal
-- authenticated admin client update would be rejected. This SECURITY DEFINER
-- function performs the check itself and bypasses RLS safely.
CREATE OR REPLACE FUNCTION public.admin_set_payment_link_status(
  _payment_link_id uuid,
  _status text,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.payment_links;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _status NOT IN ('clear', 'blocked', 'review') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  IF _status = 'blocked' AND (COALESCE(trim(_reason), '') = '') THEN
    RAISE EXCEPTION 'reason required to block';
  END IF;

  UPDATE public.payment_links
  SET admin_status = _status,
      admin_block_reason = CASE WHEN _status = 'blocked' THEN _reason ELSE NULL END,
      admin_blocked_at = CASE WHEN _status = 'blocked' THEN now() ELSE NULL END,
      admin_blocked_by = CASE WHEN _status = 'blocked' THEN auth.uid() ELSE NULL END
  WHERE id = _payment_link_id
  RETURNING * INTO v_link;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'payment link not found';
  END IF;

  INSERT INTO public.payment_link_events (payment_link_id, seller_user_id, event_type, actor_type, actor_id, metadata)
  VALUES (
    v_link.id,
    v_link.user_id,
    'admin_status_' || _status,
    'admin',
    auth.uid(),
    jsonb_build_object('reason', _reason)
  );

  RETURN to_jsonb(v_link);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_payment_link_status(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_link_status(uuid, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
