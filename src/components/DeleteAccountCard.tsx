'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import { Button, Card, FIELD, Label, SectionTitle } from '@/components/ui';
import { isNativeApp, nativePlatform } from '@/lib/native';

// ══════════════════════════════════════════════════════════════════════════════
//  Suppression de compte par son titulaire.
//
//  Apple et Google refusent une application où le compte se crée en un clic mais
//  ne se supprime que par email. Le parcours doit tenir en trois gestes : ouvrir,
//  confirmer par mot de passe, valider.
//
//  On annonce clairement ce qui reste : les factures et les missions déjà
//  réalisées sont conservées sans nom (obligations comptables). Le dire ici
//  évite la réclamation « vous n'avez pas tout effacé » — et c'est exact.
// ══════════════════════════════════════════════════════════════════════════════
export default function DeleteAccountCard() {
  const { user, logout } = useAuth();
  const { confirm, toast } = useFeedback();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!user) return null;

  async function submit() {
    setErr('');
    if (!password) { setErr('Saisissez votre mot de passe pour confirmer.'); return; }

    const sure = await confirm({
      title: 'Supprimer définitivement le compte',
      message: "Votre accès sera fermé immédiatement et vos informations personnelles effacées. Cette action est irréversible.",
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      danger: true,
    });
    if (!sure) return;

    setBusy(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          reason,
          from: isNativeApp() ? nativePlatform() : 'web',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error ?? 'Suppression impossible.'); setBusy(false); return; }

      toast('Votre compte a été supprimé.', 'success');
      await logout();
      router.replace('/login');
    } catch {
      setErr('Connexion impossible. Réessayez une fois le réseau revenu.');
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <SectionTitle>Supprimer mon compte</SectionTitle>

      {!open ? (
        <>
          <p className="text-sm text-muted mt-2 mb-4">
            La suppression ferme votre accès et efface vos informations personnelles.
            Les factures et les missions déjà réalisées sont conservées sans votre nom,
            comme la loi l’impose en matière comptable.
          </p>
          <Button variant="danger" onClick={() => setOpen(true)}>
            Supprimer mon compte
          </Button>
        </>
      ) : (
        <div className="mt-3 space-y-4">
          <p className="text-sm text-muted">
            Confirmez avec votre mot de passe. L’action est immédiate et irréversible.
          </p>

          <div>
            <Label htmlFor="del-password">Mot de passe</Label>
            <input
              id="del-password"
              type="password"
              autoComplete="current-password"
              className={`w-full ${FIELD}`}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="del-reason">Motif (facultatif)</Label>
            <textarea
              id="del-reason"
              rows={2}
              className={`w-full ${FIELD}`}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ce qui nous aiderait à nous améliorer"
            />
          </div>

          {err && <p className="text-sm text-danger">{err}</p>}

          <div className="flex gap-2">
            <Button variant="danger" onClick={submit} disabled={busy}>
              {busy ? 'Suppression…' : 'Confirmer la suppression'}
            </Button>
            <Button variant="ghost" onClick={() => { setOpen(false); setErr(''); setPassword(''); }} disabled={busy}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
