'use client';

// ── Réglage « alertes WhatsApp » ──────────────────────────────────────────────
//
// Placé là où vit ce qu'il commande (la page Réparations) plutôt que dans un
// écran de réglages que personne n'ouvre.
//
// Le numéro passe par une route serveur : la table `users` est verrouillée en
// écriture côté navigateur, et c'est voulu.

import { useState, useEffect } from 'react';
import { formatPhone, normalizePhone } from '@/lib/phone';
import { useFeedback } from '@/contexts/FeedbackContext';
import Icon from '@/components/Icon';

export default function WhatsAppAlerts() {
  const { toast } = useFeedback();
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/whatsapp/settings')
      .then(r => r.json())
      .then(d => {
        setEnabled(!!d.enabled);
        setPhone(d.phone ?? '');
        setAvailable(!!d.available);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save(nextEnabled: boolean, nextPhone: string) {
    setBusy(true);
    const res = await fetch('/api/whatsapp/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextEnabled, phone: nextPhone }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { toast(data.error ?? 'Enregistrement impossible.', 'error'); return; }
    setEnabled(!!data.enabled);
    setPhone(data.phone ?? '');
    setEditing(false);
    toast(data.enabled ? 'Alertes WhatsApp activées.' : 'Alertes WhatsApp désactivées.', 'success');
  }

  if (!loaded) return null;

  // Tant que la messagerie n'est pas configurée côté serveur, on ne propose rien
  // plutôt que de promettre des messages qui ne partiront pas.
  if (!available && !enabled) return null;

  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-gold-ink mt-0.5 shrink-0"><Icon name="phone" size={16} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink">Être prévenu sur WhatsApp</p>
          <p className="text-[11px] text-muted">
            {enabled && phone
              ? `Un dégât signalé vous est envoyé au ${formatPhone(phone)}.`
              : 'Recevez un message dès qu’un dégât est signalé dans un de vos logements.'}
          </p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} disabled={busy}
            className="shrink-0 text-[11px] font-semibold px-3 py-2 rounded-lg border border-line text-muted">
            {enabled ? 'Modifier' : 'Activer'}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-2">
          <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoFocus
            placeholder="06 12 34 56 78"
            className="w-full px-3 py-2 rounded-lg text-sm border border-line bg-card text-ink" />
          {phone.trim() && !normalizePhone(phone) && (
            <p className="text-[11px] text-danger">Ce numéro ne semble pas valide.</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => save(true, phone)} disabled={busy || !normalizePhone(phone)}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gold text-ink disabled:opacity-50">
              {busy ? '…' : 'Recevoir les alertes'}
            </button>
            {enabled && (
              <button onClick={() => save(false, phone)} disabled={busy}
                className="px-3 py-2.5 rounded-xl text-xs border border-line text-muted">Désactiver</button>
            )}
            <button onClick={() => setEditing(false)} disabled={busy}
              className="px-3 py-2.5 rounded-xl text-xs border border-line text-muted">Annuler</button>
          </div>
          <p className="text-[10px] text-faint">
            Uniquement des messages de service (dégâts signalés). Jamais de publicité, désactivable à tout moment.
          </p>
        </div>
      )}
    </div>
  );
}
