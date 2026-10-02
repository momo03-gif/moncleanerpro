'use client';

// Fiche d'accueil d'un logement, côté conciergerie.
//
// Elle la remplit une fois, la relit à l'écran telle qu'elle sortira de
// l'imprimante, et la pose dans le logement. Ce qu'elle y met répond aux
// questions qu'on lui pose vingt fois par semaine.
//
// La fiche porte SON logo et SON nom : c'est son accueil, pas notre prestation.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAirbnbsForPartner } from '@/lib/db';
import { saveFicheLogement } from '@/lib/db/airbnbs';
import type { Apartment } from '@/lib/types';
import { manquesFiche, reprendreFiche, ficheRemplie, EXEMPLES_FICHE,
  type DonneesFiche, type ChampFiche } from '@/lib/ficheLogement';
import FicheAccueil from '@/components/FicheAccueil';
import Loading from '@/components/Loading';
import Icon from '@/components/Icon';
import { uploadLogoPartenaire, getLogoPartenaire, MAX_LOGO_MB } from '@/lib/logoPartenaire';

type Champs = {
  wifiSsid: string; wifiPassword: string; wifiSecurity: 'WPA' | 'WEP' | 'nopass';
  checkinTime: string; checkoutTime: string;
  poubelles: string; parking: string; equipements: string;
  consignesDepart: string; aProximite: string;
};

const VIDE: Champs = {
  wifiSsid: '', wifiPassword: '', wifiSecurity: 'WPA',
  checkinTime: '', checkoutTime: '',
  poubelles: '', parking: '', equipements: '', consignesDepart: '', aProximite: '',
};

const champ = 'w-full px-3 py-2 rounded-xl text-sm border border-line bg-card text-ink outline-none';

export default function FicheAccueilClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [apt, setApt] = useState<Apartment | null>(null);
  const [f, setF] = useState<Champs>(VIDE);
  const [chargement, setChargement] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [erreur, setErreur] = useState(false);
  // Le logo appartient à la CONCIERGERIE, pas au logement : il est le même sur
  // toutes ses fiches, et c'est ce qui les rend présentables à ses propriétaires.
  const [logo, setLogo] = useState<string | null>(null);
  // Les autres logements de la même conciergerie dont la fiche est déjà faite :
  // quatorze appartements dans la même ville, c'est quatorze fois la même
  // réponse aux horaires et aux poubelles.
  const [modeles, setModeles] = useState<Apartment[]>([]);

  const charger = useCallback(async () => {
    if (!user?.id) return;
    const liste = await getAirbnbsForPartner(user.id);
    const a = liste.find(x => x.id === id) ?? null;
    setApt(a);
    setLogo(await getLogoPartenaire(user.id));
    setModeles(liste.filter(x => x.id !== id && ficheRemplie(x as DonneesFiche)));
    if (a) {
      setF({
        wifiSsid: a.wifiSsid ?? '', wifiPassword: a.wifiPassword ?? '',
        wifiSecurity: (a.wifiSecurity as Champs['wifiSecurity']) ?? 'WPA',
        checkinTime: a.checkinTime ?? '', checkoutTime: a.checkoutTime ?? '',
        poubelles: a.poubelles ?? '', parking: a.parking ?? '',
        equipements: a.equipements ?? '', consignesDepart: a.consignesDepart ?? '',
        aProximite: a.aProximite ?? '',
      });
    }
    setChargement(false);
  }, [user?.id, id]);

  useEffect(() => { charger(); }, [charger]);

  async function envoyerLogo(file: File) {
    if (!user?.id) return;
    setBusy(true); setMsg('');
    const { error, url } = await uploadLogoPartenaire(user.id, file);
    setErreur(!!error);
    setMsg(error ?? 'Logo enregistré — il apparaîtra sur toutes vos fiches.');
    if (!error) setLogo(url ?? null);
    setBusy(false);
  }

  /** L'exemple n'écrase rien : il ne remplit que ce qui est encore vide. */
  function exemple(cle: ChampFiche) {
    setF(s => (s[cle].trim() ? s : { ...s, [cle]: EXEMPLES_FICHE[cle] }));
  }

  function reprendre(sourceId: string) {
    const source = modeles.find(x => x.id === sourceId);
    if (!source) return;
    // Le wifi reste celui de CE logement : reprendreFiche ne le touche pas.
    setF(s => ({ ...s, ...reprendreFiche(source as DonneesFiche) } as Champs));
    setErreur(false);
    setMsg(`Réponses reprises de ${source.name}. Vérifiez les poubelles et le stationnement, puis enregistrez.`);
  }

  async function enregistrer() {
    setBusy(true); setMsg('');
    const { error } = await saveFicheLogement(id, f);
    setErreur(!!error);
    setMsg(error ?? 'Fiche enregistrée.');
    setBusy(false);
    if (!error) await charger();
  }

  if (chargement) return <Loading className="p-5 pt-8 text-sm" />;
  if (!apt) {
    return <p className="p-5 pt-8 text-sm text-muted">Logement introuvable.</p>;
  }

  // Ce qu'on imprime vient des champs SAISIS, pas de ceux enregistrés : la
  // conciergerie doit voir l'effet de ce qu'elle tape avant de valider.
  const apercu: DonneesFiche = {
    name: apt.name, address: apt.address,
    onSiteContactName: apt.onSiteContactName, onSiteContactPhone: apt.onSiteContactPhone,
    ...f,
  };
  const manques = manquesFiche(apercu);

  return (
    <div className="p-5 mcp-in">
      <div className="print-hidden">
        <button onClick={() => router.push(`/airbnb/logement/${id}`)}
          className="text-sm text-muted mb-4 inline-flex items-center gap-1">
          ← {apt.name}
        </button>

        <h1 className="text-xl font-bold text-ink">Fiche d’accueil</h1>
        <p className="text-sm mt-1 text-muted">
          Posez-la dans le logement. Le voyageur scanne le code wifi et se connecte sans rien taper.
        </p>

        {/* Ce qui manque, DIT AVANT l'impression : une fiche sans wifi ni
            horaires ne répond à aucune des questions qu'on pose. */}
        {manques.length > 0 && (
          <div className="mt-4 rounded-xl border border-warn-line bg-warn-soft px-4 py-3">
            <p className="text-xs font-semibold text-warn">Il manque {manques.join(', ')}.</p>
            <p className="text-[11px] mt-1 text-warn">
              La fiche s’imprimera quand même, mais ce sont les questions qu’on vous posera.
            </p>
          </div>
        )}

        {/* Reprendre une fiche déjà faite : le gros du contenu est identique d'un
            logement à l'autre, seuls le wifi et les poubelles changent vraiment. */}
        {modeles.length > 0 && (
          <div className="mt-4 rounded-xl border border-line bg-card px-4 py-3">
            <p className="text-sm font-semibold text-ink">Gagner du temps</p>
            <p className="text-xs mt-0.5 text-muted">
              Reprenez les réponses d’un logement déjà renseigné, puis corrigez ce qui diffère.
              Le wifi n’est jamais recopié.
            </p>
            <select className={`${champ} mt-2`} defaultValue=""
              onChange={e => { if (e.target.value) reprendre(e.target.value); e.target.value = ''; }}>
              <option value="">Choisir un logement…</option>
              {modeles.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}

        <div className="mt-5 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted">Nom du réseau wifi</label>
              <input className={champ} value={f.wifiSsid}
                onChange={e => setF(s => ({ ...s, wifiSsid: e.target.value }))} placeholder="Livebox-A1B2" />
            </div>
            <div>
              <label className="text-xs text-muted">Mot de passe wifi</label>
              <input className={champ} value={f.wifiPassword}
                onChange={e => setF(s => ({ ...s, wifiPassword: e.target.value }))} placeholder="laissez vide si réseau ouvert" />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted">Heure d’arrivée</label>
              <input className={champ} value={f.checkinTime}
                onChange={e => setF(s => ({ ...s, checkinTime: e.target.value }))}
                placeholder={EXEMPLES_FICHE.checkinTime} />
            </div>
            <div>
              <label className="text-xs text-muted">Heure de départ</label>
              <input className={champ} value={f.checkoutTime}
                onChange={e => setF(s => ({ ...s, checkoutTime: e.target.value }))}
                placeholder={EXEMPLES_FICHE.checkoutTime} />
            </div>
          </div>

          {/* Un bouton « Exemple » par champ : un libellé seul ne dit pas ce qu'on
              attend, et une conciergerie qui hésite laisse le champ vide — donc
              reçoit l'appel. Elle insère la phrase type, puis l'adapte. */}
          {([
            ['consignesDepart', 'Au départ'],
            ['poubelles', 'Poubelles'],
            ['parking', 'Stationnement'],
            ['equipements', 'Équipements'],
            ['aProximite', 'À proximité'],
          ] as const).map(([cle, libelle]) => (
            <div key={cle}>
              <div className="flex items-baseline justify-between gap-2">
                <label className="text-xs text-muted">{libelle}</label>
                <button type="button" onClick={() => exemple(cle)}
                  className="text-[11px] font-semibold text-gold">
                  Exemple
                </button>
              </div>
              <textarea className={champ} rows={3} value={f[cle]}
                onChange={e => setF(s => ({ ...s, [cle]: e.target.value }))}
                placeholder={EXEMPLES_FICHE[cle]} />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button disabled={busy} onClick={enregistrer}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gold text-ink disabled:opacity-50">
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button onClick={() => window.print()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-line text-ink inline-flex items-center gap-1.5">
            <Icon name="copy" size={14} /> Imprimer
          </button>
          {msg && <span className={`text-xs ${erreur ? 'text-danger' : 'text-success'}`}>{msg}</span>}
        </div>

        {/* Le logo vaut pour TOUTES ses fiches : on le pose ici parce que c'est
            là qu'elle en voit l'effet, pas dans un écran de réglages. */}
        <div className="mt-5 rounded-xl border border-line bg-card px-4 py-3">
          <p className="text-sm font-semibold text-ink">Votre logo</p>
          <p className="text-xs mt-0.5 text-muted">
            Il apparaît en haut de toutes vos fiches. PNG, JPEG, WebP ou SVG, {MAX_LOGO_MB} Mo maximum.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Votre logo" className="h-10 w-auto object-contain" />
            )}
            <label className="px-4 py-2 rounded-xl text-xs font-semibold border border-line text-ink cursor-pointer">
              {logo ? 'Remplacer' : 'Choisir un fichier'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                onChange={e => { const file = e.target.files?.[0]; if (file) envoyerLogo(file); }} />
            </label>
          </div>
        </div>

        <p className="text-[11px] mt-4 text-faint">
          Aucun code d’accès n’apparaît sur cette fiche : le voyageur est déjà entré, et les y écrire
          reviendrait à les donner à tous les suivants.
        </p>

        <div className="mt-6 mb-2 h-px bg-hairline" />
        <p className="text-xs text-muted mb-2">Aperçu — c’est ce qui sortira de l’imprimante.</p>
      </div>

      <div className="rounded-2xl border border-line overflow-hidden">
        <FicheAccueil logement={apercu} societe={apt.partnerName} logoUrl={logo ?? undefined} />
      </div>
    </div>
  );
}
