'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getBillingProfileDB, saveBillingProfileDB, getPartnerResumeDB,
  type PartnerResume,
} from '@/lib/db/partners';
import { Badge, Button, Card, FIELD, Label, SectionTitle } from '@/components/ui';
import Loading from '@/components/Loading';
import DeleteAccountCard from '@/components/DeleteAccountCard';
import PartnerInvoices from '@/components/PartnerInvoices';
import PartnerContract from '@/components/PartnerContract';
import PasswordCard from '@/components/PasswordCard';

// ══════════════════════════════════════════════════════════════════════════════
//  Profil du client — sa fiche chez nous.
//
//  CE QUE CET ÉCRAN DOIT DONNER EN PREMIER : la mesure de la relation. Depuis
//  quand, combien de logements, combien de ménages ce mois, ce qui reste dû.
//  Un client qui ouvre son profil et ne voit qu'un formulaire d'adresse n'a
//  aucune raison d'y revenir ; la saisie vient après, une fois qu'il sait où il
//  en est.
//
//  L'IDENTITÉ LÉGALE (raison sociale, adresse, SIRET) n'est pas un confort :
//  elle s'imprime sur la facture et dans le contrat. L'adresse est une mention
//  obligatoire (art. L.441-9 du code de commerce), le SIRET est ce qui
//  identifie la société sans ambiguïté. C'est le client qui les tient à jour,
//  parce que c'est lui qui sait quand sa structure change.
//
//  Le reste de la page suit l'ordre dans lequel on en a besoin : son contrat,
//  ses factures, sa sécurité, puis la fermeture du compte — la seule action
//  irréversible, donc la dernière.
// ══════════════════════════════════════════════════════════════════════════════

/** Deux initiales, tirées de la raison sociale. Pas d'image à téléverser. */
function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '—';
  return (mots[0][0] + (mots[1]?.[0] ?? '')).toUpperCase();
}

const moisAnnee = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : null;

const euros = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

/** Un chiffre de l'en-tête. Volontairement plat : c'est une mesure, pas une tuile. */
function Chiffre({ label, valeur, note, alerte }: {
  label: string; valeur: string; note?: string; alerte?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className={`text-xl font-bold leading-tight mt-0.5 ${alerte ? 'text-danger' : 'text-ink'}`}>{valeur}</p>
      {note && <p className="text-[11px] mt-0.5 text-faint">{note}</p>}
    </div>
  );
}

export default function PartnerProfileClient() {
  const { user } = useAuth();
  const [f, setF] = useState({ name: '', email: '', phone: '', address: '', siret: '', tvaIntracom: '' });
  const [kind, setKind] = useState<'hotel' | 'airbnb'>('airbnb');
  const [resume, setResume] = useState<PartnerResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) return;
    let annule = false;
    (async () => {
      // Les deux lectures en parallèle : l'en-tête ne doit pas attendre le
      // formulaire, ni l'inverse.
      const [p, r] = await Promise.all([getBillingProfileDB(), getPartnerResumeDB()]);
      if (annule) return;
      if (p) {
        setF({
          name: p.name, email: p.email, phone: p.phone, address: p.address,
          siret: p.siret ?? '', tvaIntracom: p.tvaIntracom ?? '',
        });
        setKind(p.kind);
      }
      setResume(r);
      setLoading(false);
    })();
    return () => { annule = true; };
  }, [user]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF(s => ({ ...s, [k]: e.target.value }));

  async function save() {
    setErr(''); setMsg('');
    if (!f.name.trim()) { setErr('Le nom de la structure est requis : c’est lui qui figure sur la facture.'); return; }
    setBusy(true);
    const { error, colonnesIgnorees } = await saveBillingProfileDB(f);
    setBusy(false);
    if (error) { setErr(error); return; }
    // Une colonne pas encore migrée : on le dit plutôt que de laisser croire
    // que tout est passé. Le client verrait sa saisie disparaître au retour.
    setMsg(colonnesIgnorees && colonnesIgnorees.length > 0
      ? 'Enregistré, sauf une partie des informations : une mise à jour technique est encore en attente de notre côté. Nous la reprendrons.'
      : 'Informations enregistrées. Elles figureront sur vos prochaines factures.');
  }

  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  const nom = f.name || user?.name || 'Votre structure';
  const depuis = moisAnnee(resume?.clientDepuis);
  const solde = resume?.soldeDu ?? 0;

  return (
    <div className="p-5 pb-24">
      {/* ── En-tête : qui est ce client, et où en est la relation ─────────── */}
      <Card className="p-5 mb-6">
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className="shrink-0 h-14 w-14 rounded-2xl bg-surface border border-line grid place-items-center"
          >
            <span className="text-base font-bold tracking-tight text-ink">{initiales(nom)}</span>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-ink leading-tight truncate">{nom}</h1>
            <p className="text-xs text-muted mt-1">
              {kind === 'hotel' ? 'Compte hôtelier' : 'Conciergerie partenaire'}
              {depuis && <> · client depuis {depuis}</>}
            </p>
          </div>

          <Badge tone="success">Actif</Badge>
        </div>

        <div className="mt-5 pt-4 border-t border-hairline grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Chiffre
            label="Logements suivis"
            valeur={resume?.logements != null ? String(resume.logements) : '—'}
          />
          <Chiffre
            label="Ménages ce mois"
            valeur={resume?.menagesMois != null ? String(resume.menagesMois) : '—'}
            note="interventions terminées"
          />
          <Chiffre
            label="À venir"
            valeur={resume?.menagesAVenir != null ? String(resume.menagesAVenir) : '—'}
            note="interventions planifiées"
          />
          <Chiffre
            label="Reste à régler"
            valeur={euros(solde)}
            alerte={solde > 0}
            note={
              resume && resume.facturesEnRetard > 0
                ? `dont ${resume.facturesEnRetard} en retard`
                : solde > 0 ? 'dans les délais' : 'tout est réglé'
            }
          />
        </div>
      </Card>

      {/* ── Identité légale et facturation ────────────────────────────────── */}
      <Card className="p-5">
        <SectionTitle>Identité et facturation</SectionTitle>
        <p className="-mt-1 mb-5 text-xs text-muted">
          Ces informations concernent <strong>votre société</strong>. Elles s’impriment en tête
          des factures que nous vous adressons et dans votre contrat — elles n’ont rien à voir
          avec les logements que vous gérez.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="pf-name">Raison sociale</Label>
            <input id="pf-name" value={f.name} onChange={set('name')} className={FIELD}
              placeholder="Ex. Hosting Services Lyon SAS" autoComplete="organization" />
            <p className="mt-1.5 text-xs text-muted">
              Le nom exact qui engage votre société. Il peut différer du nom sous lequel on vous connaît.
            </p>
          </div>

          <div>
            <Label htmlFor="pf-siret">SIRET</Label>
            <input id="pf-siret" value={f.siret} onChange={set('siret')} className={FIELD}
              placeholder="14 chiffres" inputMode="numeric" />
            <p className="mt-1.5 text-xs text-muted">
              Il identifie votre société sans ambiguïté, sur la facture comme au contrat.
            </p>
          </div>

          <div>
            <Label htmlFor="pf-tva">TVA intracommunautaire</Label>
            <input id="pf-tva" value={f.tvaIntracom} onChange={set('tvaIntracom')} className={FIELD}
              placeholder="FR 00 000000000" />
            <p className="mt-1.5 text-xs text-muted">
              À renseigner si votre société est établie hors de France. Sinon, laissez vide.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="pf-address">Adresse de facturation</Label>
            <textarea id="pf-address" value={f.address} onChange={set('address')} rows={3}
              className={FIELD} placeholder={'12 rue de la République\n69002 Lyon'} />
            <p className="mt-1.5 text-xs text-muted">
              Le siège de votre société, et non l’adresse d’un logement. Mention obligatoire sur une facture.
            </p>
          </div>

          <div>
            <Label htmlFor="pf-email">E-mail de facturation</Label>
            <input id="pf-email" type="email" value={f.email} onChange={set('email')} className={FIELD}
              placeholder="comptabilite@votre-structure.fr" autoComplete="email" />
            <p className="mt-1.5 text-xs text-muted">
              C’est là que partent vos factures. Elle peut différer de votre adresse de connexion.
            </p>
          </div>

          <div>
            <Label htmlFor="pf-phone">Téléphone</Label>
            <input id="pf-phone" value={f.phone} onChange={set('phone')} className={FIELD}
              placeholder="06 12 34 56 78" autoComplete="tel" />
            <p className="mt-1.5 text-xs text-muted">
              Pour vous joindre, aussi bien sur un règlement que sur un imprévu en intervention.
            </p>
          </div>
        </div>

        {err && <p role="alert" className="mt-4 text-sm text-danger">{err}</p>}
        {msg && <p className="mt-4 text-sm text-success">{msg}</p>}

        <div className="mt-5">
          <Button onClick={save} disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </Card>

      {/* ── Le contrat : ce qui a été convenu, et son acceptation ─────────── */}
      <div className="mt-6">
        <PartnerContract />
      </div>

      {/* ── Les factures : vert = réglé, rouge = dû ───────────────────────── */}
      <div className="mt-6">
        <PartnerInvoices />
      </div>

      <div className="mt-6">
        <PasswordCard />
      </div>

      {/* La seule action irréversible de la page : en dernier, jamais avant. */}
      <div className="mt-6">
        <DeleteAccountCard />
      </div>
    </div>
  );
}
