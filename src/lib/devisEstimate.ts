import type { Tarif, DevisLine } from './devis';

// ════════════════════════════════════════════════════════════════════════════
//  Agent d'estimation « maison » — 100 % LOCAL (aucune clé, aucune API, pas de
//  Claude). Lit une description libre et propose des lignes en repérant, dans le
//  texte, les prestations de la GRILLE TARIFS (prix fixés par l'entreprise).
//  Reconnaît le NOM de la prestation ET ses MOTS-CLÉS (synonymes/variantes que
//  tape le client : « vitres, fenêtres, baies »). Détecte une quantité proche du
//  mot repéré (ex. « 6 fenêtres » → × 6).
//  Estimation en FOURCHETTE : chaque tarif peut porter un prix_min / prix_max ;
//  l'agent renvoie une borne basse et une borne haute.
//  Module PUR (import type only) → testable et sans dépendance runtime.
// ════════════════════════════════════════════════════════════════════════════

function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Texte « tokenisé » : minuscules, sans accents, non-alphanumériques → espaces,
// bordé d'espaces pour tester des mots entiers (' mot ').
function tokenize(s: string): string {
  return ' ' + normalizeText(s).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
}

// Mots-clés d'un tarif = mots du NOM (≥ 4 lettres) + entrées de la colonne mots-clés.
// Les mots-clés explicites sont gardés même courts (ex. « t2 ») car choisis exprès.
function keysFor(t: Tarif): string[] {
  const nameN = normalizeText(t.nom).replace(/[^a-z0-9]+/g, ' ').trim();
  const nameWords = nameN.split(/\s+/).filter(w => w.length >= 4);
  const keys = new Set<string>(nameWords.length ? nameWords : [nameN]);
  for (const raw of (t.motsCles ?? '').split(',')) {
    const k = normalizeText(raw).replace(/[^a-z0-9]+/g, ' ').trim();
    if (k.length >= 2) keys.add(k);
  }
  return [...keys];
}

export function estimateFromDescription(description: string, tarifs: Tarif[]): DevisLine[] {
  const text = tokenize(description);
  const lines: DevisLine[] = [];
  for (const t of tarifs) {
    let matched = '';
    for (const w of keysFor(t)) { if (text.includes(' ' + w + ' ') || text.includes(' ' + w) || text.includes(w + ' ')) { matched = w; break; } }
    if (!matched) continue;
    if (lines.some(l => l.nom === t.nom)) continue;   // une ligne par tarif
    // Quantité : premier nombre dans une FENÊTRE autour du mot repéré (avant OU après),
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

// Fourchette d'une sélection de lignes : borne basse = Σ qté × prix_min (ou prix
// de référence si pas de fourchette), borne haute = Σ qté × prix_max. Retrouve le
// tarif par nom pour récupérer prix_min / prix_max.
export function rangeForLines(lines: DevisLine[], tarifs: Tarif[]): { low: number; high: number } {
  const byName = new Map(tarifs.map(t => [t.nom, t]));
  let low = 0, high = 0;
  for (const l of lines) {
    const t = byName.get(l.nom);
    const min = (t?.prixMin ?? null) != null ? t!.prixMin! : l.prix_unitaire;
    const max = (t?.prixMax ?? null) != null ? t!.prixMax! : l.prix_unitaire;
    low += l.quantite * min;
    high += l.quantite * max;
  }
  return { low: Math.round(low * 100) / 100, high: Math.round(high * 100) / 100 };
}

// Fourchette d'un seul tarif (pour l'affichage « 40 – 70 € » sur un bouton).
export function tarifRange(t: Tarif): { low: number; high: number } {
  const low = t.prixMin != null ? t.prixMin : t.prix;
  const high = t.prixMax != null ? t.prixMax : t.prix;
  return { low, high };
}
