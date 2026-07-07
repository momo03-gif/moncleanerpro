'use client';

import { useEffect } from 'react';

// ── Couche d'animations de la vitrine (amélioration progressive) ────────────────
// SEO/robustesse : sans JS, tout le contenu est déjà visible (rendu serveur).
// Ce composant ne fait qu'AJOUTER du mouvement : apparitions au défilement,
// ombre de la barre au scroll, et compteurs animés sur les chiffres clés.
export default function Motion() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('mcp-js');

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1) Apparition au défilement
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (reduce) {
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
    const onScroll = () => header?.classList.toggle('mcp-scrolled', window.scrollY > 8);
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
    const cio = new IntersectionObserver(
      (entries, obs) => entries.forEach(e => {
        if (e.isIntersecting) { runCount(e.target as HTMLElement); obs.unobserve(e.target); }
      }),
      { threshold: 0.5 },
    );
    counters.forEach(el => cio.observe(el));

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return null;
}
