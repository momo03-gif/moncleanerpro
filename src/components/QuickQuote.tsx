'use client';

import { useState } from 'react';
import { SOURCES } from '@/lib/proof';

// ════════════════════════════════════════════════════════════════════════════
//  Formulaire de demande court, posé DANS les pages SEO.
//  Raison d'être : le visiteur qui vient de lire la page est convaincu à cet
//  instant précis. L'envoyer vers /devis-en-ligne pour recommencer un parcours
//  en perd une partie. Le parcours complet reste proposé à côté, pour ceux qui
//  veulent une estimation chiffrée tout de suite.
//  Écrit dans la même table que /devis-en-ligne via /api/devis-request : l'admin
//  retrouve ces demandes au même endroit, sans nouveau circuit à surveiller.
// ════════════════════════════════════════════════════════════════════════════

const GOLD = '#C9A84C', INK = '#1A1A1A', MUTED = '#7A7068', BORDER = '#E8E4DC';

const field: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 11, border: `1px solid ${BORDER}`,
  backgroundColor: '#FFFFFF', color: INK, fontSize: 15, outline: 'none',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.04em',
  textTransform: 'uppercase', color: MUTED, marginBottom: 6,
};

export default function QuickQuote({ service, slug }: { service: string; slug: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'sending') return;
    const f = new FormData(e.currentTarget);
    const nom = String(f.get('nom') ?? '').trim();
    const email = String(f.get('email') ?? '').trim();
    const tel = String(f.get('tel') ?? '').trim();
    const commune = String(f.get('commune') ?? '').trim();
    const besoin = String(f.get('besoin') ?? '').trim();
    const source = String(f.get('source') ?? '').trim();

    if (!nom || !email) { setState('error'); setMessage('Merci d’indiquer votre nom et votre email.'); return; }
    setState('sending');

    // Tout le contexte part dans `description` : la table `devis` existante suffit,
    // aucune migration n'est nécessaire pour mettre ce formulaire en service.
    const description = [
      besoin && `Besoin : ${besoin}`,
      tel && `Téléphone : ${tel}`,
      commune && `Commune : ${commune}`,
      source && `Nous a connus par : ${source}`,
      `Page d’origine : /${slug} (${service})`,
    ].filter(Boolean).join('\n');

    try {
      const res = await fetch('/api/devis-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: nom, clientEmail: email, clientAddress: commune,
          description, lines: [], total: 0, partnerType: 'devis',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) {
        setState('ok');
        setMessage('Demande reçue. Nous revenons vers vous sous 24h avec un devis écrit.');
      } else {
        setState('error');
        setMessage(data?.error || "L’envoi a échoué. Appelez-nous au 07 83 43 17 00, c’est plus rapide.");
      }
    } catch {
      setState('error');
      setMessage("L’envoi a échoué. Appelez-nous au 07 83 43 17 00, c’est plus rapide.");
    }
  }

  if (state === 'ok') {
    return (
      <div className="rounded-2xl p-6 sm:p-8 text-center" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}` }}>
        <div className="inline-flex items-center justify-center rounded-full mb-4" style={{ width: 46, height: 46, backgroundColor: 'rgba(201,168,76,.14)', color: GOLD }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <p className="text-lg font-bold" style={{ color: INK }}>Merci, c’est bien envoyé.</p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl p-5 sm:p-7" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}` }} noValidate>
      <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Demande rapide</p>
      <h3 className="mt-2 text-xl sm:text-2xl font-bold" style={{ color: INK, letterSpacing: '-0.02em' }}>
        Recevez votre devis sous 24h
      </h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
        Quelques informations suffisent. C’est gratuit et sans engagement.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label style={label} htmlFor="qq-nom">Nom</label>
          <input id="qq-nom" name="nom" type="text" required autoComplete="name" style={field} placeholder="Votre nom" />
        </div>
        <div>
          <label style={label} htmlFor="qq-email">Email</label>
          <input id="qq-email" name="email" type="email" required autoComplete="email" style={field} placeholder="vous@exemple.fr" />
        </div>
        <div>
          <label style={label} htmlFor="qq-tel">Téléphone</label>
          <input id="qq-tel" name="tel" type="tel" autoComplete="tel" style={field} placeholder="Facultatif, mais plus rapide" />
        </div>
        <div>
          <label style={label} htmlFor="qq-commune">Commune</label>
          <input id="qq-commune" name="commune" type="text" style={field} placeholder="Où se situe le bien ?" />
        </div>
        <div className="sm:col-span-2">
          <label style={label} htmlFor="qq-besoin">Votre besoin</label>
          <textarea id="qq-besoin" name="besoin" rows={3} style={{ ...field, resize: 'vertical' }}
            placeholder={`En une ou deux phrases : ${service.toLowerCase()}, surface, fréquence souhaitée…`} />
        </div>
        <div className="sm:col-span-2">
          <label style={label} htmlFor="qq-source">Comment nous avez-vous connus ?</label>
          <select id="qq-source" name="source" style={field} defaultValue="">
            <option value="">— Choisir —</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {state === 'error' && (
        <p className="mt-4 text-sm" style={{ color: '#B3261E' }}>{message}</p>
      )}

      <button type="submit" disabled={state === 'sending'}
        className="mcp-btn mcp-btn-gold mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold"
        style={{ backgroundColor: GOLD, color: INK, opacity: state === 'sending' ? .6 : 1 }}>
        {state === 'sending' ? 'Envoi…' : 'Demander mon devis'}
      </button>

      <p className="mt-3 text-xs text-center leading-relaxed" style={{ color: MUTED }}>
        Vous préférez une estimation chiffrée immédiate ?{' '}
        <a href="/devis-en-ligne" className="mcp-link" style={{ color: INK, textDecorationLine: 'underline', textDecorationColor: BORDER, textUnderlineOffset: 3 }}>
          Utilisez l’estimation en ligne
        </a>.
      </p>
    </form>
  );
}
