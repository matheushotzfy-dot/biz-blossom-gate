/**
 * NOTE: Anti-tamper key/contextmenu blocks were removed — they create a false
 * sense of security (DevTools open via menu, chrome://, address bar, etc.) and
 * harm legitimate UX. Real protection lives server-side (RLS, HMAC, triggers).
 *
 * We keep only a console honeypot to warn users tricked into pasting payloads
 * ("self-XSS" social-engineering protection).
 */
export function initAntiTamper() {
  if (import.meta.env.DEV) return;
  const big = 'color:#ef4444;font-size:28px;font-weight:800;';
  const txt = 'color:#fff;font-size:13px;';
   
  console.log('%c⛔ PARE!', big);
   
  console.log(
    '%cSe alguém mandou você colar algo aqui, isso é FRAUDE e pode roubar sua conta. Nunca cole código no console.',
    txt
  );
}
