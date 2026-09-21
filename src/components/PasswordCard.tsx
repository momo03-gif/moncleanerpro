'use client';

import { useState } from 'react';
import { changePasswordDB } from '@/lib/db/partners';
import { Button, Card, FIELD, Label, SectionTitle } from '@/components/ui';

// ── Changer son mot de passe ────────────────────────────────────────────────
//
// Il n'existait aucun chemin pour cela : le client devait nous écrire, et nous
// posions un mot de passe à sa place — donc quelqu'un d'autre que lui le
// connaissait. C'est le genre de détail qui décide si un espace client a l'air
// tenu ou bricolé.
//
// Le formulaire reste replié tant qu'on ne le demande pas : personne n'ouvre
// son profil pour changer son mot de passe, mais tout le monde veut le trouver
// quand il en a besoin.

export default function PasswordCard() {
  const [ouvert, setOuvert] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirme, setConfirme] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function envoyer() {
    setErr(''); setMsg('');
    if (next !== confirme) { setErr('Les deux nouveaux mots de passe ne correspondent pas.'); return; }
    if (next.length < 8) { setErr('Le nouveau mot de passe doit faire au moins 8 caractères.'); return; }
    setBusy(true);
    const { error } = await changePasswordDB(current, next);
    setBusy(false);
    if (error) { setErr(error); return; }
    setCurrent(''); setNext(''); setConfirme(''); setOuvert(false);
    setMsg('Mot de passe modifié. Il sera demandé à votre prochaine connexion.');
  }

  return (
    <Card className="p-5">
      <SectionTitle>Sécurité</SectionTitle>

      {!ouvert ? (
        <div className="flex items-center justify-between gap-3 -mt-1">
          <p className="text-xs text-muted">
            Votre mot de passe protège l’accès à vos logements, vos codes et vos
            factures. Changez-le si vous avez un doute.
          </p>
          <Button variant="ghost" size="sm" onClick={() => { setOuvert(true); setMsg(''); }}>
            Modifier
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:max-w-md">
          <div>
            <Label htmlFor="pw-cur">Mot de passe actuel</Label>
            <input id="pw-cur" type="password" autoComplete="current-password"
              value={current} onChange={e => setCurrent(e.target.value)} className={FIELD} />
          </div>
          <div>
            <Label htmlFor="pw-new">Nouveau mot de passe</Label>
            <input id="pw-new" type="password" autoComplete="new-password"
              value={next} onChange={e => setNext(e.target.value)} className={FIELD} />
            <p className="mt-1.5 text-xs text-muted">Huit caractères au minimum.</p>
          </div>
          <div>
            <Label htmlFor="pw-cfm">Confirmer le nouveau</Label>
            <input id="pw-cfm" type="password" autoComplete="new-password"
              value={confirme} onChange={e => setConfirme(e.target.value)} className={FIELD} />
          </div>

          {err && <p role="alert" className="text-sm text-danger">{err}</p>}

          <div className="flex gap-2">
            <Button onClick={envoyer} disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button variant="ghost" onClick={() => { setOuvert(false); setErr(''); setCurrent(''); setNext(''); setConfirme(''); }}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-success">{msg}</p>}
    </Card>
  );
}
