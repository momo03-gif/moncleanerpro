// ── Envoi WhatsApp (Meta Cloud API) — SERVEUR UNIQUEMENT ──────────────────────
//
// ⚠️ Ne jamais importer ce fichier côté client : le jeton donnerait à n'importe
// qui le droit d'écrire depuis notre numéro.
//
// Pourquoi WhatsApp alors qu'on a déjà les notifications in-app et le push web :
// celles-ci supposent que la conciergerie ouvre l'application. Un dégât dans un
// logement doit sortir de l'app — WhatsApp, elle le lit.
//
// Règles Meta qu'on respecte par construction :
//   · hors fenêtre de 24 h, un message initié par l'entreprise DOIT passer par
//     un modèle approuvé (catégorie « utility ») — c'est notre seul cas d'usage ;
//   · jamais de promotion, uniquement de l'information de service ;
//   · envoi soumis au consentement explicite du destinataire (users.whatsapp_enabled).
//
// Sans les variables d'environnement, tout est INERTE : on journalise et on
// s'arrête. L'application fonctionne exactement comme avant.

const GRAPH_VERSION = 'v21.0';

export interface WhatsAppResult {
  sent: boolean;
  /** Raison de non-envoi ou d'échec — journalisée, jamais montrée au client. */
  reason?: string;
}

/** La messagerie est-elle configurée sur cet environnement ? */
export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Envoie un message à partir d'un MODÈLE approuvé.
 * `params` remplit les variables {{1}}, {{2}}… du corps, dans l'ordre.
 */
export async function sendWhatsAppTemplate(params: {
  to: string;                 // numéro normalisé, chiffres seuls (33612345678)
  template: string;           // nom du modèle approuvé côté Meta
  language?: string;          // code du modèle (fr, fr_FR, en_US…)
  variables?: string[];       // valeurs des {{1}}, {{2}}…
}): Promise<WhatsAppResult> {
  if (!isWhatsAppConfigured()) {
    console.info('[whatsapp] non configuré — envoi ignoré.');
    return { sent: false, reason: 'not_configured' };
  }
  if (!params.to) return { sent: false, reason: 'no_recipient' };

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: params.to,
    type: 'template',
    template: {
      name: params.template,
      language: { code: params.language ?? 'fr' },
      components: params.variables?.length
        ? [{ type: 'body', parameters: params.variables.map(text => ({ type: 'text', text })) }]
        : undefined,
    },
  };

  // Un envoi qui traîne ne doit pas bloquer la requête métier appelante.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Le corps d'erreur Meta contient le détail utile (modèle non approuvé,
      // numéro invalide, fenêtre dépassée…). On le journalise sans le remonter.
      const detail = await res.text().catch(() => '');
      console.error('[whatsapp] échec', res.status, detail.slice(0, 300));
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    console.error('[whatsapp] erreur réseau', aborted ? 'timeout' : (e as Error)?.message);
    return { sent: false, reason: aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

// Nom du modèle utilisé pour les dégâts. À créer et faire approuver côté Meta
// (catégorie « Utility », langue française), avec un corps du type :
//
//   Dégât signalé — {{1}}
//   {{2}}
//   Signalé par {{3}}. Détails dans votre espace MonCleanerPro.
//
// Les trois variables correspondent, dans l'ordre : nom du logement,
// description du dégât, auteur du signalement.
export const REPAIR_TEMPLATE = process.env.WHATSAPP_TEMPLATE_REPAIR ?? 'degat_signale';
