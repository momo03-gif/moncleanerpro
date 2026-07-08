import type { Metadata } from 'next';
import LegalLayout from '@/components/LegalLayout';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — MonCleanerPro',
  description: "Politique de confidentialité et protection des données personnelles (RGPD) du site MonCleanerPro.",
  alternates: { canonical: 'https://moncleanerpro.fr/confidentialite' },
  robots: { index: true, follow: true },
};

export default function ConfidentialitePage() {
  return (
    <LegalLayout title="Politique de confidentialité" updated="8 juillet 2026">
      <p>
        La présente politique décrit comment MonCleanerPro collecte, utilise et protège vos données personnelles
        lorsque vous utilisez le site <strong>moncleanerpro.fr</strong>, conformément au Règlement général sur la
        protection des données (RGPD) et à la loi Informatique et Libertés.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        Le responsable du traitement est <strong>MonCleanerPro</strong> — contact :{' '}
        <a href="mailto:info@moncleanerpro.fr">info@moncleanerpro.fr</a>, téléphone 07 83 43 17 00.
      </p>

      <h2>Données que nous collectons</h2>
      <p>Nous collectons uniquement les données que vous nous transmettez, notamment via le formulaire de demande de devis :</p>
      <ul>
        <li>Nom et prénom</li>
        <li>Adresse email et numéro de téléphone</li>
        <li>Informations relatives à votre demande (type de bien, surface, adresse d’intervention, besoins)</li>
      </ul>

      <h2>Finalités et base légale</h2>
      <ul>
        <li>Traiter et répondre à vos demandes de devis et de contact <em>(mesures précontractuelles / votre consentement)</em>.</li>
        <li>Gérer la relation client et assurer le suivi des prestations <em>(exécution du contrat)</em>.</li>
        <li>Respecter nos obligations légales et comptables <em>(obligation légale)</em>.</li>
      </ul>

      <h2>Destinataires des données</h2>
      <p>
        Vos données sont destinées aux seuls services habilités de MonCleanerPro et à ses prestataires techniques
        strictement nécessaires au fonctionnement du service (hébergement, envoi d’emails). Elles ne sont
        <strong> jamais vendues</strong> ni cédées à des tiers à des fins commerciales.
      </p>

      <h2>Durée de conservation</h2>
      <p>
        Les données liées à une demande sans suite sont conservées au maximum <strong>36 mois</strong> à compter
        du dernier contact. Les données liées à une prestation sont conservées pendant la durée de la relation
        commerciale, puis archivées conformément aux obligations légales (notamment comptables).
      </p>

      <h2>Vos droits</h2>
      <p>Conformément au RGPD, vous disposez des droits suivants sur vos données :</p>
      <ul>
        <li>Droit d’accès, de rectification et d’effacement</li>
        <li>Droit à la limitation et à l’opposition au traitement</li>
        <li>Droit à la portabilité de vos données</li>
      </ul>
      <p>
        Pour exercer ces droits, écrivez-nous à{' '}
        <a href="mailto:info@moncleanerpro.fr">info@moncleanerpro.fr</a>. Vous pouvez également introduire
        une réclamation auprès de la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>).
      </p>

      <h2>Cookies</h2>
      <p>
        Le site utilise uniquement les cookies strictement nécessaires à son bon fonctionnement. Aucun cookie
        publicitaire ou de traçage tiers n’est déposé sans votre consentement. Vous pouvez à tout moment
        configurer votre navigateur pour refuser les cookies.
      </p>

      <h2>Contact</h2>
      <p>
        Pour toute question relative à vos données personnelles :{' '}
        <a href="mailto:info@moncleanerpro.fr">info@moncleanerpro.fr</a>.
      </p>
    </LegalLayout>
  );
}
