/**
 * Anti-tampering & DevTools deterrent layer.
 * This does NOT replace server-side security (RLS, triggers, HMAC),
 * but adds friction against casual code inspection and cloning.
 */

export function initAntiTamper() {
  if (import.meta.env.DEV) return; // Skip in development

  // 1. Disable right-click context menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  // 2. Block common DevTools shortcuts
  document.addEventListener('keydown', (e) => {
    // F12
    if (e.key === 'F12') { e.preventDefault(); return false; }
    // Ctrl+Shift+I (DevTools)
    if (e.ctrlKey && e.shiftKey && e.key === 'I') { e.preventDefault(); return false; }
    // Ctrl+Shift+J (Console)
    if (e.ctrlKey && e.shiftKey && e.key === 'J') { e.preventDefault(); return false; }
    // Ctrl+U (View Source)
    if (e.ctrlKey && e.key === 'u') { e.preventDefault(); return false; }
    // Ctrl+Shift+C (Element Inspector)
    if (e.ctrlKey && e.shiftKey && e.key === 'C') { e.preventDefault(); return false; }
    // Cmd+Option+I (Mac DevTools)
    if (e.metaKey && e.altKey && e.key === 'i') { e.preventDefault(); return false; }
    // Cmd+Option+J (Mac Console)
    if (e.metaKey && e.altKey && e.key === 'j') { e.preventDefault(); return false; }
    // Cmd+Option+U (Mac View Source)
    if (e.metaKey && e.altKey && e.key === 'u') { e.preventDefault(); return false; }
  });

  // 3. Disable text selection on sensitive elements
  const style = document.createElement('style');
  style.textContent = `
    body { -webkit-user-select: none; -moz-user-select: none; user-select: none; }
    input, textarea, [contenteditable], .selectable { -webkit-user-select: text; -moz-user-select: text; user-select: text; }
  `;
  document.head.appendChild(style);

  // 4. Disable drag on images
  document.addEventListener('dragstart', (e) => {
    if (e.target instanceof HTMLImageElement) {
      e.preventDefault();
    }
  });

  // 5. Console warning honeypot (production only — silent in dev)
  if (!import.meta.env.DEV) {
    const warningStyle = 'color: red; font-size: 24px; font-weight: bold;';
    const infoStyle = 'color: white; font-size: 14px;';
    // eslint-disable-next-line no-console
    console.log('%c⛔ PARE!', warningStyle);
    // eslint-disable-next-line no-console
    console.log(
      '%cEste é um recurso do navegador destinado a desenvolvedores. Se alguém lhe disse para copiar e colar algo aqui, isso é FRAUDE e pode comprometer sua conta.',
      infoStyle
    );
  }
}
