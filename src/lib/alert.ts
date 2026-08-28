// ── Signal d'arrivée (vibration + bip court) ──────────────────────────────────
// Utilisé par la cloche de notifications ET par la pastille des demandes de
// devis : ce qui arrive doit s'entendre de la même façon, où que ça s'affiche.
// Tout est enveloppé : un navigateur qui refuse le son ou la vibration ne doit
// jamais casser l'écran qui l'appelle.
export function alertUser() {
  try { navigator.vibrate?.([120, 60, 120]); } catch { /* ignore */ }
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.04;
    o.start();
    o.stop(ctx.currentTime + 0.15);
  } catch { /* ignore */ }
}
