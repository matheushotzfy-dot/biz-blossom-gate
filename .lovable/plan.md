The objective is to unify the visual identity and quality standards of the Withdrawal and Members Area tabs, ensuring they follow the premium "Vendas/Dashboard" pattern with high-contrast typography, clean data presentation, and design system tokens.

### 1. Financeiro: Saques (Pix & Crypto)
- **PIX (Saques.tsx):**
    - Refine the header metrics to match the Vendas dashboard "Command strip" style.
    - Implement the `SortHead` pattern for the withdrawal history table.
    - Standardize status badges (e.g., APPROVED, PENDING) with consistent background/border opacity and dot indicators.
    - Use `tabular-nums` and specific font weights (`font-black`) for currency values.
    - Improve the withdrawal request dialog to be more focused and clean.
- **Crypto (SaquesCrypto.tsx):**
    - Tone down "neon" effects to match a professional fintech aesthetic.
    - Standardize the currency and price tracker UI.
    - Sync table styles and badges with the PIX tab for total consistency.

### 2. Área de Membros
- **MemberArea.tsx (Library):**
    - Improve the grid and carousel presentation.
    - Ensure all spacing uses semantic tokens (e.g., `lg:px-16`, `pb-24`).
    - Standardize the "Hero" banner typography to match the ultra-display style in the Vendas page (large, tracking-tight).
    - Refine course cards with better hover states and progress indicators.
- **MemberHome.tsx (External Area):**
    - Unify with internal tokens (`bg-background` instead of hardcoded hex).
    - Sync the "Netflix" experience with the internal library for a seamless transition.

### Technical Details
- Use `shadcn/ui` components (`Table`, `Card`, `Badge`, `Avatar`).
- Apply `framer-motion` for subtle transitions (fade-in, slide-up).
- Ensure high-contrast ratios for readability.
- Maintain "Privacy Mode" (Hide/Show values) consistently across all financial views.
