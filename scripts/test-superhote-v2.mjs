// Test d'un jeton de l'API SuperHote V2 (connect.superhote.com/api/v2/public).
//   1. Ajouter dans .env.local : SUPERHOTE_TEST_KEY=<jeton>
//   2. node scripts/test-superhote-v2.mjs
// Lecture seule. N'affiche jamais le jeton, ni aucune donnée de voyageur
// (seulement logements, dates, statuts).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ligne = fs.readFileSync(path.join(racine, '.env.local'), 'utf8').split(/\r?\n/)
  .find(l => l.startsWith('SUPERHOTE_TEST_KEY='));
const jeton = ligne?.slice('SUPERHOTE_TEST_KEY='.length).trim().replace(/^"|"$/g, '');
if (!jeton) { console.error('SUPERHOTE_TEST_KEY absent de .env.local'); process.exit(1); }

const BASE = 'https://connect.superhote.com/api/v2/public';
async function get(chemin) {
  const r = await fetch(BASE + chemin, { headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/json' } });
  const texte = await r.text();
  let corps; try { corps = JSON.parse(texte); } catch { corps = texte.slice(0, 200); }
  return { status: r.status, corps, reste: r.headers.get('x-ratelimit-remaining') };
}
async function tout(chemin, cle) {
  const out = [];
  for (let page = 1; page <= 30; page++) {
    const sep = chemin.includes('?') ? '&' : '?';
    const { status, corps } = await get(`${chemin}${sep}per_page=100&page=${page}`);
    if (status !== 200) return { erreur: `${status} ${JSON.stringify(corps).slice(0, 200)}` };
    const res = corps.result ?? {};
    out.push(...(res[cle] ?? []));
    if (!res.meta || res.meta.current_page >= res.meta.last_page) break;
  }
  return { lignes: out };
}

const jour = (d) => d.toISOString().slice(0, 10);
const aujourdhui = new Date();

// 1. Le jeton est-il accepté ?
const essai = await get('/rentals?per_page=1');
console.log(`1. Jeton : ${essai.status === 200 ? 'ACCEPTÉ' : 'REFUSÉ'} (HTTP ${essai.status})`
  + (essai.status !== 200 ? ` — ${JSON.stringify(essai.corps).slice(0, 200)}` : ` — requêtes restantes : ${essai.reste}`));
if (essai.status !== 200) process.exit(1);

// 2. Logements
const { lignes: logements = [], erreur: e1 } = await tout('/rentals', 'rentals');
if (e1) { console.log('2. Logements : erreur', e1); process.exit(1); }
console.log(`\n2. Logements : ${logements.length}`);
for (const l of logements) console.log(`   #${l.id}  ${l.name}${l.enabled === false ? '  (désactivé)' : ''}`);

// 3. Fraîcheur : réservations créées depuis le 08/10
const { lignes: recentes = [], erreur: e2 } = await tout('/reservations?created_from=2026-10-08', 'reservations');
if (e2) { console.log('\n3. Réservations récentes : erreur', e2); process.exit(1); }
const parStatut = {};
for (const r of recentes) parStatut[r.status_label ?? r.status] = (parStatut[r.status_label ?? r.status] ?? 0) + 1;
console.log(`\n3. Réservations CRÉÉES depuis le 08/10 : ${recentes.length}`, parStatut);
console.log('   (avec l’ancienne connexion, nous en recevions 0 : si ce nombre est > 0, les données sont fraîches)');

// 4. Départs et arrivées des 3 derniers jours et des 10 prochains
const du = jour(new Date(aujourdhui.getTime() - 3 * 864e5)), au = jour(new Date(aujourdhui.getTime() + 10 * 864e5));
const { lignes: proches = [] } = await tout(`/reservations?checkout_from=${du}&checkin_to=${au}`, 'reservations');
const nomDe = new Map(logements.map(l => [l.id, l.name]));
console.log(`\n4. Séjours autour d’aujourd’hui (${du} → ${au}) :`);
for (const r of proches.sort((a, b) => String(a.checkin).localeCompare(String(b.checkin)))) {
  console.log(`   ${String(nomDe.get(r.rental_id) ?? r.rental_id).padEnd(28)} arrivée ${r.checkin}  départ ${r.checkout}  ${r.status_label ?? r.status}`);
}
