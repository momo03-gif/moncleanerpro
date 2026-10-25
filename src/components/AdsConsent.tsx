'use client';

// ── Bandeau cookies + balise Google Ads (vitrine uniquement) ─────────────────
//
// Monté une fois dans le layout racine, il ne s'affiche que sur le site
// public : jamais dans l'application (admin, cleaner, partenaires), jamais sur
// app.moncleanerpro.fr, et pas du tout tant que l'identifiant Google Ads n'est
// pas configuré. Après « Accepter », il charge la balise et compte les clics
// sur un numéro de téléphone ou WhatsApp, où qu'ils soient sur la page.
// Voir lib/adsTracking.ts pour les règles de consentement.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ADS_ID, readConsent, saveConsent, loadAdsTag, trackConversion,
  CONSENT_OPEN_EVENT, CONSENT_CHANGE_EVENT,
} from '@/lib/adsTracking';

const GOLD = '#C9A84C', INK = '#1A1A1A', BORDER = '#E8E4DC', MUTED = '#7A7068';

// Espaces de l'application : ni bandeau ni balise.
const PRIVES = ['/admin', '/cleaner', '/hotel', '/airbnb', '/prestataire', '/login', '/register', '/reset', '/offline', '/devis/'];

function estPublic(pathname: string): boolean {
  if (typeof window !== 'undefined' && window.location.hostname.startsWith('app.')) return false;
  return !PRIVES.some(p => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/'));
}

export default function AdsConsent() {
  const pathname = usePathname() ?? '/';
  const [ouvert, setOuvert] = useState(false);
  const actif = !!ADS_ID && estPublic(pathname);

  // Au chargement : charger la balise si déjà accepté, sinon demander.
  useEffect(() => {
    if (!actif) return;
    const c = readConsent();
    if (c === 'granted') loadAdsTag();
    // Lecture du stockage local : impossible au rendu serveur, d'où l'effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (c === null) setOuvert(true);
  }, [actif]);

  // « Gérer les cookies » rouvre le bandeau ; un choix charge la balise.
  useEffect(() => {
    if (!actif) return;
    const rouvrir = () => setOuvert(true);
    const choix = (e: Event) => { if ((e as CustomEvent).detail === 'granted') loadAdsTag(); };
    window.addEventListener(CONSENT_OPEN_EVENT, rouvrir);
    window.addEventListener(CONSENT_CHANGE_EVENT, choix);
    return () => {
      window.removeEventListener(CONSENT_OPEN_EVENT, rouvrir);
      window.removeEventListener(CONSENT_CHANGE_EVENT, choix);
    };
  }, [actif]);

  // Un clic sur « appeler » ou WhatsApp est un contact : une conversion.
  useEffect(() => {
    if (!actif) return;
    const clic = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('tel:') || href.startsWith('https://wa.me/')) trackConversion('contact');
    };
    document.addEventListener('click', clic, true);
    return () => document.removeEventListener('click', clic, true);
  }, [actif]);

  if (!actif || !ouvert) return null;

  function choisir(c: 'granted' | 'denied') {
    saveConsent(c);
    setOuvert(false);
  }

  return (
    <div role="dialog" aria-live="polite" aria-label="Cookies"
      className="fixed z-50 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md rounded-2xl border p-4 sm:p-5"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        backgroundColor: '#FFFFFF', borderColor: BORDER, color: INK,
        boxShadow: '0 18px 40px -18px rgba(26,26,26,0.35)',
      }}>
      <p className="text-sm font-semibold">Mesure de nos annonces</p>
      <p className="text-xs leading-relaxed mt-1.5" style={{ color: MUTED }}>
        Avec votre accord, nous utilisons des cookies Google Ads pour savoir quelles annonces amènent des demandes
        de devis. Rien n&apos;est déposé si vous refusez, et le site fonctionne de la même façon.{' '}
        <Link href="/confidentialite" className="underline" style={{ color: INK }}>En savoir plus</Link>
      </p>
      {/* Refuser aussi visible et aussi simple qu'accepter (CNIL). */}
      <div className="grid grid-cols-2 gap-2 mt-3.5">
        <button onClick={() => choisir('denied')}
          className="py-2.5 rounded-xl text-sm font-semibold border"
          style={{ borderColor: BORDER, color: INK, backgroundColor: '#FFFFFF' }}>
          Refuser
        </button>
        <button onClick={() => choisir('granted')}
          className="py-2.5 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: GOLD, color: INK }}>
          Accepter
        </button>
      </div>
    </div>
  );
}
