// ════════════════════════════════════════════════════════════════════════════
//  Boutons de contact flottants (appel + WhatsApp), toujours accessibles.
//  Extrait de l'accueil pour être partagé avec les pages SEO, qui n'en avaient
//  aucun : un visiteur de page d'atterrissage devait remonter chercher un numéro.
//  Un seul composant = un seul motif visuel sur toute la vitrine.
//  Rendu serveur, sans JS.
// ════════════════════════════════════════════════════════════════════════════

const GOLD = '#C9A84C', INK = '#1A1A1A';
const PHONE_HREF = 'tel:+33783431700';
const WHATSAPP = 'https://wa.me/33783431700?text=Bonjour%2C%20je%20souhaite%20un%20devis%20de%20nettoyage.';

const IconWhatsApp = (<><path d="M12 3a8.5 8.5 0 0 0-7.3 12.9L3.5 21l5.3-1.3A8.5 8.5 0 1 0 12 3Z" /><path d="M9 8.9c-.2 1.6.4 3.2 1.6 4.4s2.8 1.8 4.4 1.6c.3 0 .5-.3.5-.6v-1c0-.3-.2-.5-.5-.6l-1.3-.3c-.2 0-.4 0-.6.2l-.4.5a6 6 0 0 1-2.3-2.3l.5-.4c.2-.2.2-.4.2-.6l-.3-1.3c0-.3-.3-.5-.6-.5h-1c-.3 0-.6.2-.6.5Z" /></>);
const IconPhone = (<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />);

function Glyph({ path, size }: { path: React.ReactNode; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
  );
}

export default function FloatingContact() {
  return (
    <div className="fixed z-40 right-4 flex flex-col items-end gap-2.5"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)' }}>
      <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" aria-label="Contacter par WhatsApp"
        className="flex items-center justify-center rounded-full shadow-lg active:scale-95"
        style={{ width: 52, height: 52, backgroundColor: '#25D366', color: '#FFFFFF' }}>
        <Glyph path={IconWhatsApp} size={26} />
      </a>
      <a href={PHONE_HREF} aria-label="Appeler MonCleanerPro"
        className="inline-flex items-center gap-2 rounded-full shadow-lg pl-4 pr-5 font-semibold text-sm active:scale-95"
        style={{ height: 52, backgroundColor: GOLD, color: INK }}>
        <Glyph path={IconPhone} size={20} /> Appeler
      </a>
    </div>
  );
}
