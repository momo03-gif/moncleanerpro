// Fournisseur PayByPhone — intégration pilotée par variables d'environnement.
// ────────────────────────────────────────────────────────────────────────────────
// PRÉREQUIS pour activer (à obtenir auprès de PayByPhone *Business* / service B2B ;
// un compte grand public ne suffit PAS) :
//   PARKING_PROVIDER=paybyphone
//   PAYBYPHONE_TOKEN_URL      (endpoint OAuth2 client_credentials)
//   PAYBYPHONE_CLIENT_ID
//   PAYBYPHONE_CLIENT_SECRET
//   PAYBYPHONE_SESSIONS_URL   (endpoint de création de session de stationnement)
//   PAYBYPHONE_SCOPE          (facultatif)
//   PAYBYPHONE_ACCOUNT_ID     (facultatif — compte flotte)
//   PAYBYPHONE_LOCATION_ID    (facultatif — zone/parcmètre)
//
// Aucune URL n'est codée en dur (elles dépendent du contrat d'API PayByPhone) : on
// se branche sur un flux OAuth2 + REST standard. Le format exact du corps de session
// est à confirmer avec leur documentation et s'ajuste dans `buildSessionPayload`.
// Tant que les variables ne sont pas définies, ce provider échoue proprement et l'app
// reste sur la saisie manuelle (PARKING_PROVIDER=manual par défaut).

import type { ParkingProvider, ParkingSessionInput, ParkingSessionResult, ParkingQuote } from './types';
import type { ParkingStatus } from '../types';

const env = (k: string): string | undefined => process.env[k] || undefined;

async function getAccessToken(): Promise<string> {
  const tokenUrl = env('PAYBYPHONE_TOKEN_URL');
  const clientId = env('PAYBYPHONE_CLIENT_ID');
  const clientSecret = env('PAYBYPHONE_CLIENT_SECRET');
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error('PayByPhone non configuré (PAYBYPHONE_TOKEN_URL / CLIENT_ID / CLIENT_SECRET manquants).');
  }
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
  const scope = env('PAYBYPHONE_SCOPE');
  if (scope) body.set('scope', scope);

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`PayByPhone OAuth ${res.status}`);
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) throw new Error('PayByPhone OAuth : access_token absent.');
  return data.access_token as string;
}

// Corps de la requête de session — à aligner sur la doc PayByPhone Business.
function buildSessionPayload(input: ParkingSessionInput): Record<string, unknown> {
  return {
    address: input.address,
    latitude: input.lat,
    longitude: input.lng,
    amount: input.amount,
    currency: 'EUR',
    durationMinutes: input.durationMinutes,
    // Plaque du véhicule : une session PayByPhone y est obligatoirement rattachée.
    licensePlate: input.licensePlate,
    accountId: env('PAYBYPHONE_ACCOUNT_ID'),
    locationId: env('PAYBYPHONE_LOCATION_ID'),
  };
}

// Extrait un montant d'une réponse, quel que soit le nom du champ.
function pickAmount(data: any): number | undefined {
  const v = data?.amount ?? data?.totalAmount ?? data?.cost ?? data?.fee ?? data?.price;
  return v != null && Number.isFinite(Number(v)) ? Number(v) : undefined;
}

export const payByPhoneProvider: ParkingProvider = {
  id: 'paybyphone',
  // Tarif PayByPhone : prix calculé pour une durée/zone (« 20 min = 1 € » provient de
  // LEUR tarif, pas d'un calcul maison). Endpoint dédié si disponible (PAYBYPHONE_QUOTE_URL).
  async quote(input: ParkingSessionInput): Promise<ParkingQuote | null> {
    const quoteUrl = env('PAYBYPHONE_QUOTE_URL');
    if (!quoteUrl || !input.durationMinutes) return null;
    try {
      const token = await getAccessToken();
      const res = await fetch(quoteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildSessionPayload(input)),
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      const amount = pickAmount(data);
      return amount != null ? { amount, currency: data.currency ?? 'EUR' } : null;
    } catch { return null; }
  },
  async createPayment(input: ParkingSessionInput): Promise<ParkingSessionResult> {
    const sessionsUrl = env('PAYBYPHONE_SESSIONS_URL');
    if (!sessionsUrl) throw new Error('PayByPhone non configuré (PAYBYPHONE_SESSIONS_URL manquant).');
    if (!input.licensePlate) throw new Error('Plaque d’immatriculation requise : renseignez le véhicule du livreur dans son profil.');

    const token = await getAccessToken();
    const res = await fetch(sessionsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(buildSessionPayload(input)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`PayByPhone session ${res.status}${data?.message ? ` : ${data.message}` : ''}`);

    // Parsing défensif (les noms de champs dépendent de l'API) : id de session, statut,
    // et surtout le MONTANT réellement facturé par PayByPhone (fait foi).
    const ref = data.id ?? data.sessionId ?? data.parkingSessionId;
    const paid = data.status === 'paid' || data.state === 'active' || data.confirmed === true;
    const status: ParkingStatus = paid ? 'paid' : 'pending';
    return {
      status,
      amount: pickAmount(data),
      currency: data.currency ?? 'EUR',
      providerRef: ref != null ? String(ref) : undefined,
      redirectUrl: data.redirectUrl ?? data.paymentUrl,
      metadata: data && typeof data === 'object' ? data : undefined,
    };
  },
};
