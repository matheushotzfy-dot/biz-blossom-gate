# Architecture Decisions

- Public marketing and authentication surfaces use the Kinetic Dark visual system: Solar Tech tokens, Sora/Manrope typography, restrained ambient motion, and reduced-motion fallbacks, keeping public styling isolated from the dashboard.

- Dashboard revenue card is minimal: title, subtitle, period chip and a single approved-revenue area chart; value details only in the hover tooltip — no summary metrics, big totals or metric switcher (user wants it clean).
- Payment operations must fail closed when no acquirer is configured; never leave UI actions calling removed gateway functions.
