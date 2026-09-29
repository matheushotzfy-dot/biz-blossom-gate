# Architecture Decisions

- Dashboard revenue card is minimal: title, subtitle, period chip and a single approved-revenue area chart; value details only in the hover tooltip — no summary metrics, big totals or metric switcher (user wants it clean).
- Payment operations must fail closed when no acquirer is configured; never leave UI actions calling removed gateway functions.
