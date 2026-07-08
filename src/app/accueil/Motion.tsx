'use client';

import { useEffect } from 'react';

// ── Couche d'animations de la vitrine (amélioration progressive) ────────────────
// SEO/robustesse : sans JS, tout le contenu est déjà visible (rendu serveur).
// Ce composant ne fait qu'AJOUTER du mouvement : apparitions au défilement,
// ombre de la barre au scroll, et compteurs animés sur les chiffres clés.
export default function Motion() {
  useEffect(() => {
    const root = document.documentElement;

    // Filet de sécurité : quoi qu'il arrive (IntersectionObserver absent, erreur JS,
    // animation qui ne se joue pas…), on rend TOUT le contenu visible. Le contenu
    // ne peut jamais rester masqué. Se déclenche même si le reste plante.
    const revealAll = () => {
      document.querySelectorAll<HTMLElement>('[data-reveal]').forEach(el => el.classList.add('mcp-in'));
      document.querySelectorAll<HTMLElement>('.mcp-rise').forEach(el => {
        el.style.opacity = '1'; el.style.transform = 'none'; el.style.animation = 'none';
      });
    };
    // IMPORTANT : on n'active PLUS le masquage avant animation (classe .mcp-js).
    // Le contenu reste donc toujours visible, quelle que soit l'exécution du JS
    // ou des animations. On révèle aussi explicitement par sécurité.
    revealAll();
    const failsafe = window.setTimeout(revealAll, 500);
    let onScroll: (() => void) | undefined;
    void root; // (conservé pour compat, plus utilisé pour masquer)

    try {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const revealEls = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

      // 1) Apparition au défilement
      if (reduce || !('IntersectionObserver' in window)) {
        revealEls.forEach(el => el.classList.add('mcp-in'));
      } else {
        const io = new IntersectionObserver(
          (entries, obs) => {
            entries.forEach(e => {
              if (e.isIntersecting) { e.target.classList.add('mcp-in'); obs.unobserve(e.target); }
            });
          },
          { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
        );
        revealEls.forEach(el => io.observe(el));
      }

      // 2) Ombre de la barre de navigation au défilement
      const header = document.getElementById('mcp-header');
      onScroll = () => header?.classList.toggle('mcp-scrolled', window.scrollY > 8);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });

      // 3) Compteurs animés (chiffres clés)
      const counters = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
      const runCount = (el: HTMLElement) => {
        const raw = el.dataset.count ?? el.textContent ?? '';
        const m = raw.match(/^(\d+)(.*)$/);
        if (!m || reduce) { el.textContent = raw; return; }
        const target = parseInt(m[1], 10);
        const suffix = m[2];
        const dur = 1100;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };
      if ('IntersectionObserver' in window) {
        const cio = new IntersectionObserver(
          (entries, obs) => entries.forEach(e => {
            if (e.isIntersecting) { runCount(e.target as HTMLElement); obs.unobserve(e.target); }
          }),
          { threshold: 0.5 },
        );
        counters.forEach(el => cio.observe(el));
      } else {
        counters.forEach(el => runCount(el));
      }
    } catch {
      revealAll(); // en cas d'erreur, on garantit l'affichage
    }

    return () => { clearTimeout(failsafe); if (onScroll) window.removeEventListener('scroll', onScroll); };
  }, []);

  return null;
}
