# Architecture Decisions

- Public marketing and authentication surfaces use the Kinetic Dark visual system: Solar Tech tokens, Sora/Manrope typography, restrained ambient motion, and reduced-motion fallbacks, keeping public styling isolated from the dashboard.

- Dashboard revenue card is minimal: title, subtitle, period chip and a single approved-revenue area chart; value details only in the hover tooltip — no summary metrics, big totals or metric switcher (user wants it clean).
- Payment operations must fail closed when no acquirer is configured; never leave UI actions calling removed gateway functions.
- Seller payment-method permissions are backend-authoritative and must be intersected into products, payment links, and public checkout data so the client cannot bypass an admin block.
- Client-callable privileged database routines live in `app_private` behind same-signature `public` SECURITY INVOKER wrappers, preserving API compatibility while keeping SECURITY DEFINER implementations outside the exposed schema.

- Realtime `postgres_changes` channels must use `uniqueChannelName()` from `src/lib/realtime.ts`: a component mounted twice (desktop + mobile) reuses an already-subscribed channel and crashes the page; presence/broadcast channels keep shared names.
