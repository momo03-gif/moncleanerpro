import type { Metadata } from 'next';
import LegalLayout from '@/components/LegalLayout';

export const metadata: Metadata = {
  title: 'Conditions générales de vente — MonCleanerPro',
  description: "Conditions générales de vente et de prestation de services de MonCleanerPro : devis, exécution, paiement, rétractation, responsabilité et réclamations.",
  alternates: { canonical: 'https://moncleanerpro.fr/conditions-generales' },
  robots: { index: true, follow: true },
};

// Médiateur de la consommation. Art. L612-1 du Code de la consommation : tout
// professionnel qui vend à des CONSOMMATEURS doit adhérer à un dispositif de
// médiation et communiquer les coordonnées du médiateur. Tant que l'adhésion
// n'est pas souscrite, on ne peut pas nommer un médiateur — ce serait faux.
// Renseigner `name` et `url` ici dès l'adhésion : le paragraphe complet
// s'affiche alors automatiquement.
const MEDIATOR: { name: string; url: string; address: string } | null = null;

export default function ConditionsGeneralesPage() {
  return (
    <LegalLayout title="Conditions générales de vente" updated="9 août 2026">
      <h2>1. Identification du prestataire</h2>
      <p>
        Les présentes conditions générales sont conclues avec <strong>MonCleanerPro</strong>, société par
        actions simplifiée, dont le siège social est situé 4 rue Albert Thomas, 38200 Vienne,
        immatriculée au RCS de Vienne sous le numéro 930 098 926, numéro de TVA intracommunautaire
        FR28930098926. Téléphone : 07 83 43 17 00 — email :{' '}
        <a href="mailto:info@moncleanerpro.fr">info@moncleanerpro.fr</a>.
      </p>

      <h2>2. Objet et champ d’application</h2>
      <p>
        Les présentes conditions régissent l’ensemble des prestations de nettoyage et d’entretien réalisées
        par MonCleanerPro : entretien récurrent, remise en état, nettoyage de fin de chantier, ménage de
        locations de courte durée et toute prestation associée figurant au devis accepté.
      </p>
      <p>
        Elles s’appliquent à tout client, <strong>professionnel</strong> comme <strong>consommateur</strong>.
        Certaines stipulations ne bénéficient qu’aux consommateurs au sens du Code de la consommation :
        elles sont expressément signalées comme telles. Toute commande implique l’acceptation sans réserve
        des présentes conditions, qui prévalent sur les conditions d’achat du client sauf accord écrit contraire.
      </p>

      <h2>3. Devis et formation du contrat</h2>
      <p>
        Toute prestation fait l’objet d’un devis écrit, gratuit et sans engagement, établi à partir des
        informations communiquées par le client. Sauf mention contraire, le devis est valable{' '}
        <strong>trente (30) jours</strong> à compter de son émission.
      </p>
      <p>
        Le contrat est formé à la date d’acceptation du devis par le client, par tout moyen écrit, y compris
        électronique. Une estimation obtenue en ligne a valeur indicative : seul le devis confirmé engage
        les parties.
      </p>
      <p>
        Si la situation constatée sur place diffère sensiblement de celle décrite au devis (surface, état,
        volume, accessibilité), MonCleanerPro en informe le client <strong>avant</strong> d’engager les
        travaux supplémentaires. Aucune prestation additionnelle n’est facturée sans accord préalable.
      </p>

      <h2>4. Prix</h2>
      <p>
        Les prix sont établis sur devis individuel, en fonction de la nature de la prestation, de la surface,
        de la fréquence, du délai souhaité et des contraintes d’accès. Ils sont exprimés en euros et
        s’entendent hors taxes ; la TVA applicable est celle en vigueur au jour de la facturation.
      </p>
      <p>
        Sauf stipulation contraire, les prix des contrats à exécution récurrente peuvent être révisés une
        fois par an, moyennant un préavis écrit d’un mois. Le client qui refuse la révision peut résilier le
        contrat dans les conditions de l’article 10.
      </p>

      <h2>5. Facturation et paiement</h2>
      <p>
        Les prestations ponctuelles sont facturées à leur achèvement. Les prestations récurrentes sont
        facturées mensuellement, à terme échu. Sauf accord écrit, le règlement intervient à{' '}
        <strong>trente (30) jours</strong> à compter de la date de facture.
      </p>
      <p>
        Conformément à l’article L441-10 du Code de commerce, tout retard de paiement entraîne de plein
        droit l’application de pénalités de retard au taux de <strong>trois fois le taux d’intérêt légal</strong>,
        ainsi que, pour les clients professionnels, une <strong>indemnité forfaitaire de recouvrement de 40 €</strong>,
        sans qu’un rappel soit nécessaire. Aucun escompte n’est accordé pour paiement anticipé.
      </p>

      <h2>6. Exécution de la prestation</h2>
      <p>
        Les dates et créneaux d’intervention sont convenus entre les parties. MonCleanerPro s’engage à
        respecter le planning arrêté et à informer le client sans délai de tout aléa affectant une intervention.
      </p>
      <p>Le client s’engage, pour permettre la bonne exécution de la prestation, à :</p>
      <ul>
        <li>permettre l’accès aux locaux aux dates et heures convenues ;</li>
        <li>mettre à disposition l’eau et l’électricité nécessaires, sauf accord contraire ;</li>
        <li>signaler tout support fragile, revêtement délicat ou consigne particulière ;</li>
        <li>mettre à l’abri les objets de valeur, fragiles ou personnels ;</li>
        <li>informer des risques particuliers propres au site et des règles de sécurité applicables.</li>
      </ul>
      <p>
        En cas d’impossibilité d’accéder aux locaux du fait du client, l’intervention est considérée comme
        due. Toute annulation par le client d’une intervention planifiée doit intervenir au moins{' '}
        <strong>quarante-huit (48) heures</strong> à l’avance ; à défaut, elle peut être facturée.
      </p>

      <h2>7. Droit de rétractation — clients consommateurs</h2>
      <p>
        Le client consommateur qui conclut un contrat à distance ou hors établissement dispose d’un délai de{' '}
        <strong>quatorze (14) jours</strong> à compter de la conclusion du contrat pour exercer son droit de
        rétractation, sans avoir à motiver sa décision ni à supporter de pénalité, conformément aux articles
        L221-18 et suivants du Code de la consommation.
      </p>
      <p>
        Pour l’exercer, il suffit d’adresser une déclaration dénuée d’ambiguïté à{' '}
        <a href="mailto:info@moncleanerpro.fr">info@moncleanerpro.fr</a> ou par courrier au siège social.
      </p>
      <p>
        Si le client demande expressément que l’exécution commence avant la fin de ce délai, il reste
        redevable du montant correspondant à la prestation déjà fournie au jour de sa rétractation. Lorsque
        la prestation a été <strong>intégralement exécutée</strong> avant la fin du délai, avec l’accord
        préalable exprès du client et sa renonciation expresse à son droit de rétractation, celui-ci ne peut
        plus être exercé.
      </p>

      <h2>8. Qualité, réclamations et reprise</h2>
      <p>
        MonCleanerPro est tenue d’une obligation de moyens renforcée quant à la qualité des prestations
        réalisées. Toute réclamation doit être formulée par écrit dans un délai de{' '}
        <strong>quarante-huit (48) heures</strong> suivant l’intervention, en précisant les points concernés.
      </p>
      <p>
        Dans ce délai, MonCleanerPro s’engage à <strong>reprendre sans frais supplémentaires</strong> la ou
        les zones signalées. Cet engagement constitue la contrepartie normale d’une prestation dont le client
        n’assiste pas nécessairement à l’exécution.
      </p>

      <h2>9. Responsabilité et assurance</h2>
      <p>
        MonCleanerPro a souscrit une assurance de responsabilité civile professionnelle couvrant les
        conséquences pécuniaires des dommages causés dans le cadre de ses prestations. Une attestation est
        communiquée sur simple demande.
      </p>
      <p>
        Tout dommage doit être signalé par écrit dans un délai de <strong>quarante-huit (48) heures</strong>{' '}
        suivant l’intervention, afin de permettre les constatations utiles. Passé ce délai, l’imputabilité du
        dommage ne peut plus être établie de manière fiable.
      </p>
      <p>
        La responsabilité de MonCleanerPro ne saurait être engagée pour les dommages résultant : d’une
        information erronée ou incomplète fournie par le client ; de la vétusté, de la fragilité non signalée
        ou d’un défaut d’entretien antérieur d’un support ; de la disparition d’objets de valeur laissés à
        portée ; ou d’un cas de force majeure. Sauf faute lourde ou dolosive, et à l’égard des seuls clients
        professionnels, l’indemnisation est limitée au montant hors taxes de la prestation concernée.
      </p>
      <p>
        Certaines prestations ne relèvent pas du périmètre de MonCleanerPro et sont exclues de plein droit :
        travaux en hauteur nécessitant nacelle ou intervention sur corde, dégraissage des conduits
        d’extraction, élimination des déchets d’activités de soins à risques infectieux, désamiantage,
        dépollution et évacuation de gravats en volume. Ces prestations relèvent d’entreprises spécialisées
        et, le cas échéant, certifiées.
      </p>

      <h2>10. Durée, résiliation et suspension</h2>
      <p>
        Les contrats à exécution récurrente sont conclus pour la durée figurant au devis. À défaut de
        précision, ils sont conclus pour une durée indéterminée et peuvent être résiliés par chacune des
        parties, par écrit, moyennant un préavis d’<strong>un (1) mois</strong>.
      </p>
      <p>
        En cas de manquement grave de l’une des parties à ses obligations, non réparé dans un délai de
        quinze (15) jours après mise en demeure, l’autre partie peut résilier le contrat de plein droit.
        MonCleanerPro peut par ailleurs suspendre ses prestations en cas de défaut de paiement persistant,
        après mise en demeure restée infructueuse.
      </p>

      <h2>11. Personnel et non-sollicitation</h2>
      <p>
        Le personnel affecté aux prestations demeure sous la seule autorité, direction et contrôle de
        MonCleanerPro. Le client s’interdit d’embaucher ou de faire travailler directement, pendant la durée
        du contrat et les douze (12) mois suivant son terme, tout intervenant ayant participé à l’exécution
        des prestations, sauf accord écrit préalable.
      </p>

      <h2>12. Force majeure</h2>
      <p>
        Aucune des parties ne peut être tenue responsable d’un manquement résultant d’un cas de force
        majeure au sens de l’article 1218 du Code civil. La partie empêchée en informe l’autre sans délai ;
        les obligations sont suspendues pendant la durée de l’empêchement.
      </p>

      <h2>13. Données personnelles</h2>
      <p>
        Les données collectées dans le cadre d’une demande de devis ou d’une prestation sont traitées
        conformément au Règlement général sur la protection des données. Les finalités, durées de
        conservation et modalités d’exercice des droits sont détaillées dans notre{' '}
        <a href="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>14. Médiation de la consommation</h2>
      {MEDIATOR ? (
        <p>
          Conformément aux articles L611-1 et suivants du Code de la consommation, le client consommateur
          peut recourir gratuitement au médiateur de la consommation dont relève MonCleanerPro :{' '}
          <strong>{MEDIATOR.name}</strong>, {MEDIATOR.address} —{' '}
          <a href={MEDIATOR.url} target="_blank" rel="noopener noreferrer">{MEDIATOR.url}</a>.
        </p>
      ) : (
        <p>
          Le client consommateur est invité à adresser toute réclamation à{' '}
          <a href="mailto:info@moncleanerpro.fr">info@moncleanerpro.fr</a>, afin de rechercher une solution
          amiable. Conformément aux articles L611-1 et suivants du Code de la consommation, il dispose
          également du droit de recourir gratuitement à un médiateur de la consommation ; les coordonnées du
          médiateur compétent lui sont communiquées sur simple demande.
        </p>
      )}
      <p>
        La plateforme européenne de règlement en ligne des litiges est accessible à l’adresse{' '}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.
      </p>

      <h2>15. Droit applicable et juridiction</h2>
      <p>
        Les présentes conditions sont soumises au droit français. À défaut de résolution amiable, tout litige
        avec un client <strong>professionnel</strong> relève de la compétence exclusive du tribunal du ressort
        du siège social de MonCleanerPro. Le client <strong>consommateur</strong> conserve la faculté de
        saisir la juridiction de son choix parmi celles territorialement compétentes en application du Code
        de procédure civile.
      </p>
    </LegalLayout>
  );
}
