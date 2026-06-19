'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#FAFAF8' }}>
      <div className="text-center max-w-xs">
        <div className="mx-auto mb-6 flex items-center justify-center font-bold" style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#1A1A1A', color: '#C9A84C', fontSize: 28 }}>M</div>
        <h1 className="text-xl font-bold mb-2" style={{ color: '#1A1A1A' }}>Pas de connexion</h1>
        <p className="text-sm mb-6" style={{ color: '#A8A09A' }}>
          Vous êtes hors ligne. Vérifiez votre connexion internet et réessayez.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
