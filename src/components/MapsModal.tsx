'use client';

export default function MapsModal({ address, onClose }: { address: string; onClose: () => void }) {
  const encoded = encodeURIComponent(address);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(26,26,26,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: '#FFFFFF' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: '#E8E4DC' }}>
          <p className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Ouvrir l'adresse</p>
          <p className="text-xs mt-1 truncate" style={{ color: '#A8A09A' }}>{address}</p>
        </div>
        <div className="p-3 space-y-2">
          {[
            { href: `https://maps.google.com/?q=${encoded}`, icon: '🗺', label: 'Ouvrir dans Google Maps' },
            { href: `https://maps.apple.com/?q=${encoded}`, icon: '📍', label: 'Ouvrir dans Plans (Apple Maps)' },
          ].map(({ href, icon, label }) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" onClick={onClose}
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: '#F5F3EF', color: '#1A1A1A' }}>
              <span className="text-base">{icon}</span>
              {label}
            </a>
          ))}
        </div>
        <div className="px-3 pb-3">
          <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#F8F6F2', color: '#A8A09A' }}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
