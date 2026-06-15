---
name: Admin Console V4 — Navy Trust
description: Navy Trust palette + Sora/Manrope typography + sidebar focada layout. Replaces V3 tokens at end of index.css.
type: design
---
Admin panel uses the Navy Trust palette: navy `#0f1b3d` primary, steel blue `#3b6fa0` accent rail, off-white `#eef2f8` background. Dark mode: deep navy `#060c1a`, surfaces `#0c1730`/`#11203f`, steel blue `#3b6fa0` accent.

Fonts: Sora 700 for headings/tabs/table headers; Manrope 500 for body. JetBrains Mono for code. Tabular-nums always on for numbers via `ss01`+`tnum` feature settings.

Sidebar "focada": active item uses `--as-accent-soft` background plus a 3px left rail in `--as-rail` (steel blue), no filled chip. Maintains the existing `.af-accent-bg` API — only the inside-aside variant is overridden via CSS scope.

All tokens live in the V4 block at the bottom of `src/index.css`. Cascades through every admin tab via `.admin-shell` and `.admin-frame`. Do not re-add the V3 navy/slate token block above it.
