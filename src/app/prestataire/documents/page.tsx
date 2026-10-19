'use client';

import DocumentsPrestataire from '@/components/DocumentsPrestataire';

// Espace prestataire — ses documents administratifs (Kbis, attestation URSSAF,
// assurance), que nous devons détenir et tenir à jour.
export default function PrestataireDocumentsPage() {
  return (
    <div className="p-5">
      <div className="mb-5 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Documents</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>
          Kbis, attestation de vigilance URSSAF et assurance : nous devons les avoir à jour pour vous confier des missions.
        </p>
      </div>
      <DocumentsPrestataire />
    </div>
  );
}
