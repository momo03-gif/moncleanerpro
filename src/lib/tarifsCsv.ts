import type { TarifUnite } from './devis';

// ════════════════════════════════════════════════════════════════════════════
//  Parseur CSV de grille tarifaire — module PUR (aucune dépendance runtime),
//  utilisé par l'import de tarifs dans l'admin. Calqué sur l'export de la grille
//  MonCleanerPro : colonnes « Prestation ; Unité ; Prix ; Mots-clés ; Actif ».
//
//  Tolérant : délimiteur ; ou , détecté auto (Excel FR exporte en ;), champs
//  entre guillemets gérés, BOM UTF-8 retiré, prix simple « 45 » OU fourchette
//  « 40-70 » / « 40 à 70 » / « 2,5 – 5 » (décimale FR à la virgule) acceptés.
// ════════════════════════════════════════════════════════════════════════════

export interface TarifImportRow {
  nom: string; unite: TarifUnite; prix: number;
  motsCles?: string; prixMin?: number | null; prixMax?: number | null;
}
export interface TarifCsvResult { rows: TarifImportRow[]; errors: string[] }

function stripAccentsLower(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Découpe une ligne CSV en respectant les guillemets ("" = guillemet échappé).
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// Mappe un libellé d'unité vers l'enum autorisé (forfait | m2 | heure | piece).
// Les unités « à l'unité » (passage, store, volet, ml, porte…) → 'piece'.
export function parseUnite(raw: string): TarifUnite {
  const u = stripAccentsLower(raw);
  if (!u) return 'forfait';
  if (u.includes('m2') || u.includes('m²') || u.includes('metre carre') || u.includes('au m')) return 'm2';
  if (u.startsWith('heure') || u === 'h' || u.includes('/heure') || u.includes('horaire')) return 'heure';
  if (u.startsWith('forfait')) return 'forfait';
  if (/(piece|unite|passage|store|volet|porte|poignee|grille|volee|luminaire|marche|\bml\b|lineaire|par )/.test(u)) return 'piece';
  return 'forfait';
}

// Extrait tous les nombres FR d'un texte : « 1 500 » → 1500, « 2,5 » → 2.5.
function numbersIn(s: string): number[] {
  const cleaned = s.replace(/ | /g, ' ');
  const found = cleaned.match(/\d[\d ]*(?:,\d+)?(?:\.\d+)?/g) ?? [];
  const nums: number[] = [];
  for (let n of found) {
    n = n.replace(/ /g, '').replace(',', '.');
    const v = Number(n);
    if (Number.isFinite(v)) nums.push(v);
  }
  return nums;
}

// Cellule Prix → { prix (référence = milieu), prixMin, prixMax }.
// Vide / « Sur devis » → prix 0, fourchette nulle. Un seul nombre → prix fixe.
export function parsePrix(raw: string): { prix: number; prixMin: number | null; prixMax: number | null } {
  const nums = numbersIn(raw ?? '');
  if (nums.length === 0) return { prix: 0, prixMin: null, prixMax: null };
  if (nums.length === 1) return { prix: nums[0], prixMin: null, prixMax: null };
  const lo = Math.min(...nums), hi = Math.max(...nums);
  return { prix: Math.round(((lo + hi) / 2) * 100) / 100, prixMin: lo, prixMax: hi };
}

// En-têtes reconnus (accent/casse-insensible) → index de colonne.
function mapHeaders(cells: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  cells.forEach((c, i) => {
    const h = stripAccentsLower(c);
    if (idx.nom === undefined && /(prestation|nom|service|libelle|designation)/.test(h)) idx.nom = i;
    else if (idx.unite === undefined && /unite/.test(h)) idx.unite = i;
    else if (idx.prix === undefined && /(prix|tarif|fourchette|montant)/.test(h)) idx.prix = i;
    else if (idx.mots === undefined && /(mot|cle|keyword|synonyme)/.test(h)) idx.mots = i;
    else if (idx.actif === undefined && /actif/.test(h)) idx.actif = i;
  });
  return idx;
}

export function parseTarifsCsv(text: string): TarifCsvResult {
  const errors: string[] = [];
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return { rows: [], errors: ['Fichier vide.'] };
  const lines = clean.split('\n').filter(l => l.trim());
  // Délimiteur : ; s'il domine dans l'en-tête (Excel FR), sinon ,
  const head = lines[0];
  const delim = (head.split(';').length > head.split(',').length) ? ';' : ',';
  const idx = mapHeaders(splitCsvLine(head, delim));
  if (idx.nom === undefined || idx.prix === undefined) {
    return { rows: [], errors: ["En-têtes introuvables. Colonnes attendues : Prestation ; Unité ; Prix ; Mots-clés ; Actif."] };
  }
  const rows: TarifImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delim);
    const nom = (cells[idx.nom] ?? '').trim();
    if (!nom) continue;
    const unite = parseUnite(idx.unite !== undefined ? cells[idx.unite] ?? '' : '');
    const { prix, prixMin, prixMax } = parsePrix(idx.prix !== undefined ? cells[idx.prix] ?? '' : '');
    const motsCles = idx.mots !== undefined ? (cells[idx.mots] ?? '').trim() : '';
    rows.push({ nom, unite, prix, prixMin, prixMax, motsCles: motsCles || undefined });
  }
  if (rows.length === 0) errors.push('Aucune ligne de prestation trouvée.');
  return { rows, errors };
}
