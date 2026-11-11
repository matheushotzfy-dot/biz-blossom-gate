-- The public SECURITY INVOKER wrapper runs as the signed-in user, so that role
-- needs EXECUTE on the private implementation (same pattern as snooze_my_kyc_popup).
-- The implementation itself enforces auth.uid(), real uploaded documents and
-- only moves pending/rejected -> pending_review.
REVOKE ALL ON FUNCTION app_private.mark_kyc_submitted() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.mark_kyc_submitted() TO authenticated, service_role;