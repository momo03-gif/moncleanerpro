import type { Metadata } from 'next';
import LegalLayout from '@/components/LegalLayout';

export const metadata: Metadata = {
  title: 'Mentions légales — MonCleanerPro',
  description: "Mentions légales du site MonCleanerPro, société de nettoyage professionnel à Lyon.",
  alternates: { canonical: 'https://moncleanerpro.fr/mentions-legales' },
  robots: { index: true, follow: true },
};

export default function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales" updated="8 juillet 2026">
      <h2>Éditeur du site</h2>
      <p>
        Le site <strong>moncleanerpro.fr</strong> est édité par <strong>MonCleanerPro</strong>.
      </p>
      <ul>
        <li>Forme juridique : <strong>Société par actions simplifiée (SAS)</strong></li>
        <li>Siège social : <strong>4 rue Albert Thomas, 38200 Vienne</strong></li>
        <li>SIRET : <strong>930 098 926 00015</strong> (SIREN 930 098 926)</li>
        <li>RCS : <strong>RCS Vienne 930 098 926</strong></li>
        <li>Numéro de TVA intracommunautaire : <strong>FR28930098926</strong></li>
        <li>Téléphone : <strong>07 83 43 17 00</strong></li>
        <li>Email : <a href="mailto:info@moncleanerpro.fr">info@moncleanerpro.fr</a></li>
        <li>Responsable de la publication : <strong>Abran Carmen Fieni</strong>, Président(e)</li>
      </ul>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis
        — <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L’ensemble des contenus présents sur ce site (textes, logo, marque, éléments graphiques, mise en page)
        est la propriété de MonCleanerPro, sauf mention contraire. Toute reproduction, représentation ou
        diffusion, totale ou partielle, sans autorisation préalable écrite est interdite et constituerait une
        contrefaçon au sens du Code de la propriété intellectuelle.
      </p>

      <h2>Responsabilité</h2>
      <p>
        MonCleanerPro s’efforce d’assurer l’exactitude et la mise à jour des informations diffusées sur ce site,
        mais ne saurait garantir l’absence totale d’erreurs. Les informations fournies le sont à titre indicatif
        et sont susceptibles d’évoluer. MonCleanerPro ne saurait être tenue responsable de l’utilisation qui en
        est faite ni des éventuels dommages directs ou indirects résultant de l’accès ou de l’usage du site.
      </p>

      <h2>Liens externes</h2>
      <p>
        Le site peut contenir des liens vers des sites tiers. MonCleanerPro n’exerce aucun contrôle sur ces sites
        et décline toute responsabilité quant à leur contenu.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Le traitement de vos données personnelles est décrit dans notre{' '}
        <a href="/confidentialite">Politique de confidentialité</a>.
      </p>

      <h2>Contact</h2>
      <p>
        Pour toute question relative au site, vous pouvez nous écrire à{' '}
        <a href="mailto:info@moncleanerpro.fr">info@moncleanerpro.fr</a>.
      </p>
    </LegalLayout>
  );
}
