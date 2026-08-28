'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getDevisByTokenDB, setDevisStatusByTokenDB, type Devis } from '@/lib/devis';
import { getAppointmentForDevisDB } from '@/lib/appointments';
import Loading from "@/components/Loading";

function money(n: number) { return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
function frDate(dateISO: string) {
  return new Date(dateISO + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Page PUBLIQUE (lien unique) — le client consulte son devis et l'accepte/refuse.
// Accepter n'est PAS la dernière étape : dès que le devis est accepté, on enchaîne
// sur le choix de la date d'intervention (/rendez-vous, pré-rempli avec le numéro
// de devis et les coordonnées). Sans ça, le client acceptait puis attendait un
// rappel — la prise de date se perdait.
export default function PublicDevisPage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  const [devis, setDevis] = useState<Devis | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<'accepte' | 'refuse' | null>(null);
  // Rendez-vous déjà réservé pour ce devis → on affiche la date au lieu de
  // reproposer d'en choisir une (le client revient souvent sur son lien).
  const [appt, setAppt] = useState<{ date: string; time: string } | null>(null);

  useEffect(() => {
    getDevisByTokenDB(token).then(async d => {
      setDevis(d);
      setDone(d?.status === 'accepte' ? 'accepte' : d?.status === 'refuse' ? 'refuse' : null);
      if (d?.status === 'accepte' && d.number) {
        setAppt(await getAppointmentForDevisDB(d.number).catch(() => null));
      }
      setLoading(false);
    });
  }, [token]);

  async function decide(accept: boolean) {
    await setDevisStatusByTokenDB(token, accept ? 'accepte' : 'refuse');
    setDone(accept ? 'accepte' : 'refuse');
    // Devis corrigé puis ré-accepté : si un créneau avait déjà été réservé sur la
    // version précédente, on le rappelle au lieu de faire rebooker pour rien.
    if (accept && devis?.number) setAppt(await getAppointmentForDevisDB(devis.number).catch(() => null));
  }

  // Lien vers la prise de rendez-vous, pré-rempli. Le formulaire attend prénom et
  // nom séparés : on découpe le nom complet du devis (1er mot = prénom).
  function bookingUrl(d: Devis): string {
    const full = (d.clientName ?? '').trim();
    const [prenom, ...reste] = full.split(/\s+/);
    return '/rendez-vous?' + new URLSearchParams({
      ...(d.number ? { devis: d.number } : {}),
      ...(prenom ? { prenom } : {}),
      ...(reste.length ? { nom: reste.join(' ') } : {}),
      ...(d.clientEmail ? { email: d.clientEmail } : {}),
    }).toString();
  }

  if (loading) return <Loading className="min-h-screen flex items-center justify-center text-sm" />;
  if (!devis) return <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: '#A8A09A' }}>Devis introuvable.</div>;

  return (
    <div className="min-h-screen py-10 px-5" style={{ backgroundColor: '#FAFAF8' }}>
      <div className="max-w-lg mx-auto rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="px-6 py-5 border-b" style={{ borderColor: '#F2EFE9' }}>
          <img src="/logo-full.png" alt="MonCleanerPro" style={{ height: 52, width: 'auto', marginBottom: 14 }} />
          <p className="text-xs uppercase tracking-wider" style={{ color: '#C9A84C' }}>
            Devis {devis.number}{devis.revision > 1 ? ` · version ${devis.revision}` : ''}
          </p>
          <h1 className="text-xl font-bold mt-1" style={{ color: '#1A1A1A' }}>{devis.clientName || 'Votre devis'}</h1>
          {devis.validUntil && <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Valable jusqu’au {new Date(devis.validUntil).toLocaleDateString('fr-FR')}</p>}
        </div>

        {/* Devis corrigé : le client doit comprendre AVANT de lire les lignes
            pourquoi sa proposition a changé, sinon il compare deux devis sans
            savoir lequel fait foi. */}
        {devis.revision > 1 && (
          <div className="px-6 py-4 border-b" style={{ backgroundColor: '#FBF4E2', borderColor: '#EBD9A8' }}>
            <p className="text-sm font-semibold" style={{ color: '#8A6A1E' }}>
              Devis mis à jour{devis.revisedAt ? ` le ${new Date(devis.revisedAt).toLocaleDateString('fr-FR')}` : ''}
            </p>
            {devis.revisionNote && (
              <p className="text-sm mt-1.5 whitespace-pre-line" style={{ color: '#7A6538' }}>{devis.revisionNote}</p>
            )}
            <p className="text-xs mt-2" style={{ color: '#A8945E' }}>
              Cette version remplace la précédente
              {devis.previousTotal != null ? ` (${money(devis.previousTotal * 1.2)} TTC)` : ''}. Seule celle-ci fait foi.
            </p>
          </div>
        )}
        <div className="px-6 py-4 space-y-2">
          {devis.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: '#7A7068' }}>{l.nom} {l.quantite > 1 ? `× ${l.quantite}` : ''}</span>
              <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{money(l.total)}</span>
            </div>
          ))}
          <div className="pt-3 border-t mt-2 space-y-1.5" style={{ borderColor: '#F2EFE9' }}>
            <div className="flex items-center justify-between text-sm"><span style={{ color: '#7A7068' }}>Total HT</span><span style={{ color: '#1A1A1A' }}>{money(devis.total)}</span></div>
            <div className="flex items-center justify-between text-sm"><span style={{ color: '#7A7068' }}>TVA 20 %</span><span style={{ color: '#1A1A1A' }}>{money(devis.total * 0.2)}</span></div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>Net à payer (TTC)</span>
              <span className="text-lg font-bold" style={{ color: '#C9A84C' }}>{money(devis.total * 1.2)}</span>
            </div>
          </div>
        </div>
        <div className="px-6 pb-6">
          {done === 'accepte' ? (
            appt ? (
              <div className="rounded-xl px-4 py-3.5 text-center" style={{ backgroundColor: '#EAF3EC', color: '#4E7D5E' }}>
                <p className="text-sm font-semibold">Devis accepté — intervention programmée</p>
                <p className="text-sm mt-1" style={{ textTransform: 'capitalize' }}>{frDate(appt.date)} à {appt.time}</p>
                <a href={bookingUrl(devis)} className="inline-block text-xs mt-2 underline" style={{ color: '#4E7D5E' }}>Choisir un autre créneau</a>
              </div>
            ) : (
              <div>
                <div className="rounded-xl px-4 py-3 text-sm font-medium text-center" style={{ backgroundColor: '#EAF3EC', color: '#4E7D5E' }}>
                  Devis accepté — merci !
                </div>
                <p className="text-sm text-center mt-4 mb-3" style={{ color: '#7A7068' }}>
                  Dernière étape : choisissez la date de votre intervention.
                </p>
                <a href={bookingUrl(devis)}
                  className="block w-full py-3 rounded-xl text-sm font-semibold text-center"
                  style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF', textDecoration: 'none' }}>
                  Choisir ma date d’intervention
                </a>
              </div>
            )
          ) : done === 'refuse' ? (
            <div className="rounded-xl px-4 py-3 text-sm font-medium text-center" style={{ backgroundColor: '#FBECEA', color: '#B85A50' }}>Devis refusé.</div>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => decide(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Refuser</button>
              <button onClick={() => decide(true)} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>Accepter</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
