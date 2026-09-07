import { MACRO_DEF, SECTION_ORDER } from '@/lib/devisCatalog';

// ══════════════════════════════════════════════════════════════════════════════
//  Contenu SERVEUR de la page de devis.
//
//  Le sélecteur de prestations est un composant client alimenté par Supabase :
//  dans le HTML servi, il ne reste qu'un H1. Googlebot voyait donc une page vide
//  sur celle qui reçoit TOUS les appels à l'action du site — le profil exact
//  d'une page classée « Explorée, actuellement non indexée ».
//
//  Ce bloc rend, côté serveur, ce que la page dit réellement : comment marche
//  l'estimation, ce que couvre le catalogue, et les questions qu'on nous pose.
//  Il est placé SOUS l'outil : le parcours de conversion n'est pas touché, on
//  ajoute seulement ce que le robot (et le visiteur qui hésite) avait besoin de lire.
//
//  RÈGLE PRODUIT : aucun prix ici. Les montants n'apparaissent qu'à l'écran
//  d'estimation, une fois les prestations choisies.
// ══════════════════════════════════════════════════════════════════════════════

const FAQ: { q: string; a: string }[] = [
  {
    q: 'L’estimation est-elle vraiment gratuite et sans engagement ?',
    a: "Oui, dans les deux cas. L’estimation en ligne est immédiate et ne vous engage à rien, et le devis écrit que nous établissons ensuite non plus. Vous ne réglez quoi que ce soit qu’après avoir accepté une intervention.",
  },
  {
    q: 'Pourquoi une fourchette et non un prix ferme ?',
    a: "Parce qu’un montant ferme donné sans avoir vu les lieux serait révisé après la première intervention, ce qui est la pire façon de commencer. La fourchette vous donne l’ordre de grandeur tout de suite ; le devis ferme arrive une fois connus l’état réel et la fréquence retenue, et il est confirmé avant toute intervention.",
  },
  {
    q: 'Sous quel délai obtient-on le devis écrit ?',
    a: "Sous 24 heures ouvrées après votre demande. Si votre besoin est urgent, indiquez-le dans la description : les demandes marquées comme urgentes passent en priorité de traitement.",
  },
  {
    q: 'Intervenez-vous en dehors de Lyon ?',
    a: "Oui, dans toute la métropole lyonnaise et le Beaujolais, de Villefranche-sur-Saône à Vénissieux. Pour les gros chantiers de fin de travaux, nos équipes se déplacent partout en France depuis Lyon.",
  },
  {
    q: 'Le crédit d’impôt est-il pris en compte dans l’estimation ?',
    a: "Oui, lorsque vos prestations y ouvrent droit. Pour l’entretien d’un domicile de particulier, l’écran d’estimation affiche le montant réellement à votre charge après les 50 % pris en charge au titre des services à la personne. Un logement loué en meublé touristique ou un local professionnel n’y ouvre en revanche aucun droit.",
  },
  {
    q: 'Que se passe-t-il après l’envoi de ma demande ?',
    a: "Elle arrive directement dans notre file de traitement et nous vous rappelons pour caler les derniers points — accès, fréquence, contraintes particulières. Vous pouvez aussi choisir votre créneau d’intervention dans la foulée, avant même que le devis soit confirmé.",
  },
];

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const LINKS: { label: string; href: string }[] = [
  { label: 'Ménage à domicile à Lyon', href: '/menage-domicile-lyon' },
  { label: 'Crédit d’impôt ménage à domicile', href: '/credit-impot-menage-domicile' },
  { label: 'Ménage Airbnb à Lyon', href: '/menage-airbnb-lyon' },
  { label: 'Nettoyage de bureaux à Lyon', href: '/nettoyage-bureaux-lyon' },
  { label: 'Nettoyage de fin de chantier à Lyon', href: '/nettoyage-fin-de-chantier-lyon' },
  { label: 'Nettoyage de fin de bail à Lyon', href: '/nettoyage-fin-de-bail-lyon' },
];

export default function DevisContent() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <section className="dc" aria-label="À propos de l’estimation">
        <style>{CSS}</style>
        <div className="dc-in">
          <h2>Comment fonctionne l’estimation</h2>
          <p>
            L’outil ci-dessus part de ce que vous voulez faire faire, et non d’une grille de tarifs
            générique. Vous parcourez les catégories, cochez les prestations qui vous concernent,
            précisez les quantités quand elles comptent — une surface, un nombre de vitres — et
            l’estimation s’affiche à la dernière étape. Vous pouvez aussi décrire votre besoin en
            quelques mots et laisser les prestations se cocher toutes seules.
          </p>
          <ol className="dc-steps">
            <li>
              <strong>Vous décrivez votre besoin</strong>
              <span>En texte libre ou en parcourant les catégories de prestations.</span>
            </li>
            <li>
              <strong>Vous obtenez une fourchette immédiate</strong>
              <span>Avec, pour un domicile de particulier, le montant réellement à votre charge après crédit d’impôt.</span>
            </li>
            <li>
              <strong>Nous confirmons par un devis écrit</strong>
              <span>Sous 24 heures ouvrées, après avoir cadré l’accès, la fréquence et les contraintes.</span>
            </li>
          </ol>

          <h2>Ce que couvre le catalogue</h2>
          <p>
            Six familles de prestations, du logement de particulier au chantier de fin de travaux.
            Chacune se décline en interventions précises que vous sélectionnez une à une.
          </p>
          <div className="dc-grid">
            {MACRO_DEF.map(m => (
              <div key={m.id} className="dc-card">
                <h3>{m.title}</h3>
                <p className="dc-tag">{m.tagline}</p>
                <ul>
                  {(SECTION_ORDER[m.id] ?? []).map(s => <li key={s}>{s}</li>)}
                </ul>
              </div>
            ))}
          </div>

          <h2>Questions fréquentes</h2>
          <dl className="dc-faq">
            {FAQ.map(f => (
              <div key={f.q}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>

          <h2>En savoir plus sur nos prestations</h2>
          <ul className="dc-links">
            {LINKS.map(l => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
          </ul>
        </div>
      </section>
    </>
  );
}

const CSS = `
.dc{background:#FAFAF8;border-top:1px solid #E8E4DC;color:#1A1A1A;
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;}
.dc-in{max-width:1120px;margin:0 auto;padding:48px 18px 64px;}
.dc h2{font-size:22px;letter-spacing:-.02em;margin:38px 0 12px;}
.dc h2:first-child{margin-top:0;}
.dc p{color:#7A7068;font-size:14.5px;line-height:1.65;margin:0 0 14px;max-width:70ch;}
.dc-steps{list-style:none;counter-reset:s;padding:0;margin:20px 0 0;display:grid;gap:14px;}
.dc-steps li{counter-increment:s;position:relative;padding-left:44px;}
.dc-steps li::before{content:counter(s);position:absolute;left:0;top:0;width:29px;height:29px;
  border-radius:9px;background:rgba(201,168,76,.14);color:#9A7B22;font-weight:700;font-size:13px;
  display:flex;align-items:center;justify-content:center;}
.dc-steps strong{display:block;font-size:14.5px;margin-bottom:3px;}
.dc-steps span{color:#7A7068;font-size:13.5px;line-height:1.55;}
.dc-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));margin-top:18px;}
.dc-card{background:#FFF;border:1px solid #E8E4DC;border-radius:14px;padding:18px 19px;}
.dc-card h3{font-size:15px;margin:0 0 5px;}
.dc-tag{font-size:12.5px;color:#A8A09A;margin:0 0 11px;line-height:1.45;}
.dc-card ul{margin:0;padding-left:17px;}
.dc-card li{font-size:13px;color:#7A7068;line-height:1.7;}
.dc-faq{margin:18px 0 0;}
.dc-faq div{border-top:1px solid #E8E4DC;padding:15px 0;}
.dc-faq dt{font-weight:650;font-size:14.5px;margin-bottom:6px;}
.dc-faq dd{margin:0;color:#7A7068;font-size:14px;line-height:1.65;max-width:78ch;}
.dc-links{list-style:none;padding:0;margin:14px 0 0;display:flex;flex-wrap:wrap;gap:9px;}
.dc-links a{display:inline-block;padding:8px 14px;border:1px solid #E8E4DC;border-radius:999px;
  background:#FFF;color:#1A1A1A;font-size:13.5px;text-decoration:none;}
.dc-links a:hover{border-color:#C9A84C;color:#9A7B22;}
@media(max-width:600px){.dc-in{padding:36px 16px 48px;}.dc h2{font-size:19.5px;}}
`;
