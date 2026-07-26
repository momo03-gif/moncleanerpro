import type { Tarif, DevisLine } from './devis';

// ════════════════════════════════════════════════════════════════════════════
//  Agent d'estimation « maison » — 100 % LOCAL (aucune clé, aucune API, pas de
//  Claude). Lit une description libre et propose des lignes en repérant, dans le
//  texte, les prestations de la GRILLE TARIFS (prix fixés par l'entreprise).
//  Détecte une quantité juste avant le mot-clé (ex. « 6 fenêtres » → × 6).
//  Module PUR (import type only) → testable et sans dépendance runtime.
// ════════════════════════════════════════════════════════════════════════════

function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function estimateFromDescription(description: string, tarifs: Tarif[]): DevisLine[] {
  const text = ' ' + normalizeText(description).replace(/[^a-z0-9]+/g, ' ') + ' ';
  const lines: DevisLine[] = [];
  for (const t of tarifs) {
    const nameN = normalizeText(t.nom);
    // Mots-clés = mots du nom ≥ 4 lettres (sinon le nom entier).
    const words = nameN.split(/\s+/).filter(w => w.length >= 4);
    const keys = words.length ? words : [nameN];
    let matched = '';
    for (const w of keys) { if (text.includes(' ' + w) || text.includes(w + ' ')) { matched = w; break; } }
    if (!matched) continue;
    if (lines.some(l => l.nom === t.nom)) continue;   // une ligne par tarif
    // Quantité : premier nombre dans une FENÊTRE autour du mot-clé (avant OU après),
    // ex. « 6 fenêtres » ou « vitres de 6 » → 6. Défaut 1 (le client ajuste ensuite).
    let qty = 1;
    const idx = text.indexOf(matched);
    const win = text.slice(Math.max(0, idx - 22), Math.min(text.length, idx + matched.length + 22));
    const m = win.match(/\d{1,3}/);
    if (m) { const n = parseInt(m[0], 10); if (Number.isFinite(n) && n > 0 && n < 200) qty = n; }
    lines.push({ nom: t.nom, quantite: qty, prix_unitaire: t.prix, total: Math.round(qty * t.prix * 100) / 100 });
  }
  return lines;
}
