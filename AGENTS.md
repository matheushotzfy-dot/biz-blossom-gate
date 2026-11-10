# Architecture Decisions
- Inactive sellers uses admin-only, account-scoped validated RPC pagination; login/attempt inactivity is separate from historical approved sales, simulated records and staff are excluded, and the stable detail pane exposes no documents or wallet actions.
- Top Sellers reuses validated admin analytics aggregates and the shared date filter; ranked rows are server-paginated, exports explicitly cover the current filtered page and never expose documents.
- Sellers directory uses admin-only period aggregates and server pagination; seller records keep fixed positioning, scoped caches and explicit history limits, while money actions use audited manual-approval routines and reinforced confirmation.
- Analytics uses admin-only aggregate RPCs with São Paulo date boundaries and paginated seller rows; account activity, paid-sales cohorts and dated risk events stay explicitly separate, and client counts use normalized purchase emails rather than exposing buyer identities.

- Command center uses account-scoped, abortable aggregate RPCs for exact queues and period metrics; failed loads never report healthy status, and reviewing an error is distinct from fixing its cause.

- Admin overview KPIs and charts use account-scoped aggregate queries across real records with São Paulo date boundaries; capped lists serve operational previews only, and fee margin is never presented as full company profit.

- Customer support fills the authenticated shell's available space using a flex inbox/conversation layout, not viewport-height caps; account-scoped caches, unique realtime subscriptions and scoped theme tokens preserve isolation, while human ticket messages retain existing attachment primitives.

- Public marketing (`src/components/landing-vp`) always renders in the light brand identity via tokens scoped to `.vp-site`, using only illustrative example data (never database queries); authentication defaults light with account-synced dark mode, while checkout keeps its product-defined theme.

- Dashboard revenue card is minimal: title, subtitle, period chip and a single approved-revenue area chart; value details only in the hover tooltip — no summary metrics, big totals or metric switcher (user wants it clean).
- Payment operations must fail closed when no acquirer is configured; never leave UI actions calling removed gateway functions.
- Seller payment-method permissions are backend-authoritative and must be intersected into products, payment links, and public checkout data so the client cannot bypass an admin block.
- Client-callable privileged database routines live in `app_private` behind same-signature `public` SECURITY INVOKER wrappers, preserving API compatibility while keeping SECURITY DEFINER implementations outside the exposed schema.

- Realtime `postgres_changes` channels must use `uniqueChannelName()` from `src/lib/realtime.ts`: a component mounted twice (desktop + mobile) reuses an already-subscribed channel and crashes the page; presence/broadcast channels keep shared names.
- Seller payment-link lists use server-side RPC pagination and aggregate counters; never restore unbounded client-side loading as volume grows.
- Admin global refreshes are serialized and coalesced; never allow focus, polling and realtime to run overlapping dashboard loads.
- Confirmed checkout delivery is idempotent and audited in `checkout_delivery_attempts`; only server-confirmed payments may grant member access, and unresolved deliveries stay pending for owner review.
- Theme preference is stored on the authenticated profile and defaults to light; never restore cookie/localStorage persistence for theme.
- Integration credentials are encrypted at rest and decrypted only by service-role dispatch routines; browser queries use masked safe views.

- Staff policy changes are atomically audited through owner-only routines; individual fee floors fail closed, and assigned staff can only place separate withdrawal blocks, never block/delete seller accounts or release holds.
- Manager portfolios use one temporal active assignment per seller; operational access starts at assignment, ends on transfer, while immutable commission history remains tied to the original accrual.

- Visual identity lives in a final unlayered token block at the end of `src/index.css` that overrides all legacy layers (root, dark, admin `--as-*`, auth and admin-content scopes); change brand colors there rather than in older layers.
- Seller area navigation lives in `src/components/seller-shell/navConfig.ts` (navy top bar + horizontal tabs on desktop, bottom bar with central Cobrar on mobile); the old seller sidebar is no longer rendered, so add seller pages there.
