// Bascule des connexions SuperHote de l'ancienne API (V1, figée après la
// migration du compte) vers la nouvelle (V2).
//
//   node scripts/migrer-superhote-v2.mjs              → SIMULATION (ne modifie rien)
//   node scripts/migrer-superhote-v2.mjs --appliquer  → applique
//
// Jeton V2 lu dans .env.local (SUPERHOTE_TEST_KEY) — jamais affiché.
//
// POURQUOI UN SCRIPT, ET PAS SIMPLEMENT CHANGER LA CLÉ
// Les réservations portent un identifiant différent dans la V2. Changer la clé
// seule ferait croire à la synchro que tous les anciens séjours ont disparu :
// annulés, et leurs ménages avec — ménages assignés compris. On RÉÉTIQUETTE
// donc d'abord chaque séjour existant avec son identifiant V2 (même logement,
// mêmes dates, exemplaire CONFIRMÉ de préférence : la migration SuperHote a
// parfois créé un double annulé), puis on bascule la clé et le logement.
//
// CORRESPONDANCE DES LOGEMENTS : les numéros V2 diffèrent des numéros V1. On
// les relie par les dates des séjours (identiques dans les deux versions avant
// la migration). Un logement sans correspondance nette est laissé tel quel.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const APPLIQUER = process.argv.includes('--appliquer');
const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(racine, '.env.local'), 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const jeton = env.SUPERHOTE_TEST_KEY;
if (!/^\d+\|\S+$/.test(jeton ?? '')) { console.error('SUPERHOTE_TEST_KEY absent ou pas au format V2.'); process.exit(1); }

const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' };
const db = async (chemin, init = {}) => {
  const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/' + chemin, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`base ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};
const v2 = async (chemin) => {
  for (let essai = 0; essai < 3; essai++) {
    const r = await fetch('https://connect.superhote.com/api/v2/public' + chemin, { headers: { Authorization: 'Bearer ' + jeton, Accept: 'application/json' } });
    if (r.status === 429) { await new Promise(x => setTimeout(x, 15000)); continue; }
    if (!r.ok) throw new Error(`SuperHote ${r.status} ${(await r.text()).slice(0, 150)}`);
    return r.json();
  }
  throw new Error('SuperHote : trop de requêtes');
};

// 1. Séjours V2 (tous logements) sur une large fenêtre.
const sejoursV2 = [];
for (let page = 1; page <= 80; page++) {
  const j = await v2(`/reservations?checkout_from=2026-06-01&checkout_to=2028-12-31&per_page=100&page=${page}`);
  sejoursV2.push(...j.result.reservations.map(r => ({ id: r.id, rental: r.rental_id, du: r.checkin.slice(0, 10), au: r.checkout.slice(0, 10), statut: r.status })));
  if (j.result.meta.current_page >= j.result.meta.last_page) break;
}
const parRental = new Map();
for (const s of sejoursV2) { const l = parRental.get(s.rental) ?? []; l.push(s); parRental.set(s.rental, l); }

// 2. Nos connexions SuperHote et leurs séjours.
const flux = await db('reservation_feeds?select=id,airbnb_id,external_property_id,api_key,airbnbs(name)&platform=eq.superhote&active=eq.true');
console.log(`${APPLIQUER ? 'APPLICATION' : 'SIMULATION'} — ${flux.length} connexions SuperHote, ${sejoursV2.length} séjours V2 (${parRental.size} logements)\n`);

const dejaPris = new Set();
let total = { reetiquetes: 0, bascules: 0 };
for (const f of flux) {
  const nom = (f.airbnbs?.name ?? '?').trim();
  if (/^\d+\|/.test(f.api_key ?? '')) { console.log(`${nom.padEnd(18)} déjà en V2 (#${f.external_property_id}) — rien à faire`); continue; }
  const nos = await db(`reservations?select=id,external_uid,check_in,check_out,status,mission_id&feed_id=eq.${f.id}`);
  const nosConfirmes = nos.filter(r => r.status === 'confirmed' && r.check_out >= '2026-06-01');
  const paires = new Set(nosConfirmes.map(r => r.check_in + '>' + r.check_out));

  // Logement V2 dont les séjours CONFIRMÉS coïncident le plus avec les nôtres.
  let meilleur = null, score = 0, second = 0;
  for (const [rental, l] of parRental) {
    if (dejaPris.has(rental)) continue;
    const n = new Set(l.filter(s => s.statut === 1 && paires.has(s.du + '>' + s.au)).map(s => s.du + '>' + s.au)).size;
    if (n > score) { second = score; score = n; meilleur = rental; } else if (n > second) second = n;
  }
  // Correspondance nette : au moins 2 séjours communs, et nettement devant le suivant.
  if (!meilleur || score < 2 || second >= score) {
    console.log(`${nom.padEnd(18)} PAS DE CORRESPONDANCE SÛRE (meilleur ${score}, suivant ${second}) — laissé tel quel`);
    continue;
  }
  dejaPris.add(meilleur);

  // 3. Réétiquetage : chaque séjour (même annulé) → son exemplaire V2 aux mêmes dates.
  const l = parRental.get(meilleur);
  const utilises = new Set();
  const plan = [];
  for (const r of nos) {
    if (r.external_uid?.startsWith('superhote-v2-')) continue;
    const memesDates = l.filter(s => s.du === r.check_in && s.au === r.check_out && !utilises.has(s.id));
    // L'ancienne version FUSIONNAIT les séjours qui se suivent (27→29 + 29→01
    // devenaient 27→01). Ce qui compte pour le ménage, c'est le DÉPART : à
    // défaut des dates exactes, on raccroche au séjour V2 confirmé qui part le
    // même jour — son ménage reste en place au lieu d'être annulé puis recréé.
    const memeDepart = r.status === 'confirmed'
      ? l.find(s => s.statut === 1 && s.au === r.check_out && !utilises.has(s.id)) : undefined;
    const cible = memesDates.find(s => s.statut === 1) ?? memeDepart ?? (r.status !== 'confirmed' ? memesDates[0] : undefined);
    if (!cible) continue;
    utilises.add(cible.id);
    plan.push({ id: r.id, uid: `superhote-v2-${cible.id}`, avecMenage: !!r.mission_id });
  }
  const futursSansEquivalent = nosConfirmes.filter(r => r.check_out >= new Date().toISOString().slice(0, 10)
    && !plan.some(p => p.id === r.id)).length;
  console.log(`${nom.padEnd(18)} V1 #${f.external_property_id} → V2 #${meilleur} (${score} séjours communs) — `
    + `${plan.length} séjours réétiquetés (${plan.filter(p => p.avecMenage).length} avec ménage)`
    + (futursSansEquivalent ? ` — ${futursSansEquivalent} séjour(s) à venir absent(s) de la V2 (seront annulés)` : ''));

  if (APPLIQUER) {
    for (const p of plan) {
      await db(`reservations?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify({ external_uid: p.uid }), headers: { Prefer: 'return=minimal' } });
    }
    await db(`reservation_feeds?id=eq.${f.id}`, { method: 'PATCH',
      body: JSON.stringify({ api_key: jeton, external_property_id: String(meilleur) }), headers: { Prefer: 'return=minimal' } });
  }
  total.reetiquetes += plan.length; total.bascules++;
}
console.log(`\n${APPLIQUER ? 'Fait' : 'Prévu'} : ${total.bascules} connexions basculées, ${total.reetiquetes} séjours réétiquetés.`
  + (APPLIQUER ? ' Lancer ensuite une synchronisation.' : ' Relancer avec --appliquer pour appliquer.'));
