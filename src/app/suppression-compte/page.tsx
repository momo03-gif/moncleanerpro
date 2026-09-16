import type { Metadata } from 'next';
import Link from 'next/link';
import LegalLayout from '@/components/LegalLayout';

// Page publique de demande de suppression de compte.
// Google Play EXIGE une adresse web, accessible sans installer l'application,
// qui explique comment supprimer son compte et ce qui est conservé. C'est cette
// adresse que l'on renseigne dans la fiche du Play Console (« Suppression de
// compte »). Elle sert aussi de recours à qui n'a plus accès à l'application.
export const metadata: Metadata = {
  title: 'Supprimer mon compte — MonCleanerPro',
  description: "Comment supprimer votre compte MonCleanerPro et quelles données sont conservées.",
  alternates: { canonical: 'https://moncleanerpro.fr/suppression-compte' },
  robots: { index: true, follow: true },
};

export default function SuppressionComptePage() {
  return (
    <LegalLayout title="Supprimer mon compte" updated="13 septembre 2026">
      <p>
        Vous pouvez supprimer votre compte MonCleanerPro à tout moment, depuis l’application
        comme depuis le site. La suppression est immédiate et définitive.
      </p>

      <h2>Depuis l’application ou le site</h2>
      <ol>
        <li>Connectez-vous à votre espace.</li>
        <li>
          Ouvrez <strong>Mon compte</strong> (espace hôtel), <strong>Profil</strong> (espace
          conciergerie / Airbnb) ou <strong>Profil</strong> (espace intervenant).
        </li>
        <li>Dans la section <strong>Supprimer mon compte</strong>, confirmez avec votre mot de passe.</li>
      </ol>

      <h2>Si vous n’avez plus accès à votre compte</h2>
      <p>
        Écrivez à <a href="mailto:info@moncleanerpro.fr">info@moncleanerpro.fr</a> depuis l’adresse
        email associée au compte, ou appelez le <strong>07 83 43 17 00</strong>. La demande est
        traitée sous 30 jours au plus tard.
      </p>

      <h2>Ce qui est supprimé</h2>
      <ul>
        <li>Votre accès et vos identifiants de connexion.</li>
        <li>Votre nom, votre adresse email, votre numéro de téléphone et votre adresse postale.</li>
        <li>Vos notifications et l’enregistrement de vos appareils (notifications push).</li>
      </ul>

      <h2>Ce qui est conservé, et pourquoi</h2>
      <p>
        Les factures émises et les interventions déjà réalisées sont conservées <strong>sans votre
        nom</strong> : la loi impose de conserver les pièces comptables pendant 10 ans
        (article L.123-22 du code de commerce) et les documents liés à la paie pendant 5 ans.
        Ces documents ne permettent plus de vous identifier.
      </p>

      <h2>Vos autres droits</h2>
      <p>
        Accès, rectification, portabilité, opposition : voir notre{' '}
        <Link href="/confidentialite">politique de confidentialité</Link>. Vous pouvez également saisir la
        CNIL en cas de désaccord.
      </p>
    </LegalLayout>
  );
}
