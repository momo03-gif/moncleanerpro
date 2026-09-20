// ── Détection du spam de formulaire (logique PURE) ───────────────────────────
//
// Le formulaire de devis est public : des robots l'ont trouvé. Cinq demandes en
// un mois, toutes du même moule — un numéro du Bangladesh, une adresse gmail, et
// un texte de démarchage (« avis positifs », « marketing agency »), aucune
// prestation cochée, donc 0 €.
//
// PRINCIPE : on ne bloque pas un client maladroit pour attraper un robot. Un
// vrai prospect écrit parfois mal, laisse un champ vide, ou décrit son besoin en
// deux mots. Chaque indice pèse, et il en faut PLUSIEURS pour écarter une
// demande. En cas de doute, la demande passe — mais sans faire sonner le
// téléphone de l'admin à 3 h du matin.
//
// Trois issues :
//   'ok'      → demande normale, enregistrée et notifiée ;
//   'doute'   → enregistrée, mais SANS notification (l'admin la verra dans sa
//               liste, sans être dérangé) ;
//   'spam'    → jamais enregistrée. On répond quand même « c'est envoyé » au
//               robot : lui dire qu'il est repéré l'aiderait à s'adapter.

export interface Soumission {
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  description?: string;
  total?: number;
  lignes?: number;
  /** Champ piège, invisible pour un humain. Rempli = robot, sans discussion. */
  honeypot?: string;
  /** Millisecondes entre l'affichage du formulaire et l'envoi. */
  dureeSaisieMs?: number;
}

export interface Verdict {
  issue: 'ok' | 'doute' | 'spam';
  score: number;
  motifs: string[];
}

// Le vocabulaire du démarchage automatisé. Volontairement spécifique : « site
// internet » ou « devis » n'ont rien à y faire, un vrai client les emploie.
const DEMARCHAGE = [
  'seo', 'backlink', 'referencement naturel garanti', 'first page of google',
  'marketing agency', 'digital marketing', 'business owner', 'dear sir', 'dear madam',
  'avis positifs', 'avis google positifs', 'boost your', 'increase your sales',
  'web development', 'mobile app development', 'outsourcing', 'externalisation',
  'bpo', 'call center', 'lead generation', 'crypto', 'bitcoin', 'investment opportunity',
  'sehr geehrte', 'unsubscribe', 'click here', 'whatsapp me',
];

/** Indicatifs dont aucun client d'un service de ménage à Lyon n'appelle. */
const INDICATIFS_IMPROBABLES = ['+880', '+234', '+92', '+91', '+212 6 00', '+998', '+84'];

function normalise(v: string): string {
  return v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Un numéro exploitable en France : 10 chiffres, ou +33 suivi de 9. */
export function telephoneFrancais(tel: string): boolean {
  const c = tel.replace(/[^\d+]/g, '');
  if (/^0\d{9}$/.test(c)) return true;
  if (/^\+33\d{9}$/.test(c)) return true;
  if (/^0033\d{9}$/.test(c)) return true;
  return false;
}

export function evaluerSpam(s: Soumission): Verdict {
  const motifs: string[] = [];
  let score = 0;

  // ── Les deux certitudes ────────────────────────────────────────────────────
  if ((s.honeypot ?? '').trim()) {
    return { issue: 'spam', score: 100, motifs: ['champ piège rempli'] };
  }
  // Un humain ne remplit pas nom, email et besoin en moins de trois secondes.
  if (typeof s.dureeSaisieMs === 'number' && s.dureeSaisieMs >= 0 && s.dureeSaisieMs < 3000) {
    return { issue: 'spam', score: 100, motifs: ['formulaire rempli en moins de 3 s'] };
  }

  const texte = normalise([s.description, s.clientName, s.clientAddress].filter(Boolean).join(' '));

  // ── Les indices ────────────────────────────────────────────────────────────
  const mots = DEMARCHAGE.filter(m => texte.includes(m));
  if (mots.length > 0) {
    score += mots.length >= 2 ? 60 : 40;
    motifs.push(`vocabulaire de démarchage (${mots.slice(0, 3).join(', ')})`);
  }

  const tel = (s.clientPhone ?? '').replace(/[^\d+]/g, '');
  if (tel && INDICATIFS_IMPROBABLES.some(i => tel.startsWith(i.replace(/\s/g, '')))) {
    score += 40;
    motifs.push('indicatif téléphonique sans rapport avec la zone desservie');
  } else if (tel && !telephoneFrancais(tel) && tel.startsWith('+') && !tel.startsWith('+33')) {
    // Un numéro étranger n'est pas disqualifiant en soi (propriétaire expatrié),
    // mais c'est un indice de plus.
    score += 15;
    motifs.push('numéro étranger');
  }

  // Un lien dans une demande de ménage : c'est du démarchage, pas un besoin.
  const liens = (s.description ?? '').match(/https?:\/\/|www\./gi);
  if (liens) { score += 35; motifs.push('lien dans la description'); }

  // Aucune prestation, aucun montant, mais un long discours : le moule exact des
  // demandes reçues. Un vrai client qui décrit son besoin reste court.
  const longueur = (s.description ?? '').length;
  if ((s.lignes ?? 0) === 0 && (s.total ?? 0) === 0 && longueur > 300) {
    score += 30;
    motifs.push('aucune prestation choisie mais long message');
  }

  // Adresse absente ET téléphone absent : on ne peut ni se déplacer ni rappeler.
  if (!(s.clientAddress ?? '').trim() && !tel) {
    score += 10;
    motifs.push('ni adresse ni téléphone');
  }

  const issue: Verdict['issue'] = score >= 60 ? 'spam' : score >= 35 ? 'doute' : 'ok';
  return { issue, score, motifs };
}
