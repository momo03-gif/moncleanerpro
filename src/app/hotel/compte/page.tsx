'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Card, PageTitle } from '@/components/ui';
import DeleteAccountCard from '@/components/DeleteAccountCard';

// Page « Mon compte » de l'espace hôtel. Elle n'existait pas : les informations
// de l'établissement sont saisies à l'inscription puis gérées par nous. Elle
// devient nécessaire parce que la suppression de compte doit être accessible
// depuis l'application (exigence App Store et Google Play) — autant y présenter
// aussi les informations du compte, qui étaient invisibles jusqu'ici.
export default function HotelComptePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="p-5 pt-6">
      <PageTitle title="Mon compte" subtitle="Vos informations de connexion" />

      <Card className="p-5 mt-4">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Établissement</dt>
            <dd className="font-medium text-ink text-right">{user.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Adresse email</dt>
            <dd className="font-medium text-ink text-right break-all">{user.email}</dd>
          </div>
          {user.phone && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Téléphone</dt>
              <dd className="font-medium text-ink text-right">{user.phone}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-muted">
          Pour modifier ces informations, écrivez-nous à info@moncleanerpro.fr ou appelez le 07 83 43 17 00.
        </p>
      </Card>

      <div className="mt-6">
        <DeleteAccountCard />
      </div>
    </div>
  );
}
