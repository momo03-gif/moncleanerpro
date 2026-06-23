import { NextResponse } from 'next/server';
import {
  getRhConfigDB, saveRhConfigDB,
  getPrimeTypesDB, createPrimeTypeDB, updatePrimeTypeDB, deletePrimeTypeDB,
  getIncidentsForCleanerDB, getMissionIncidentsDB, createIncidentDB, deleteIncidentDB,
  getPrimeRequestsDB, resolvePrimeRequestDB, getAllCleanerRhDB,
} from '@/lib/rh';

// ══════════════════════════════════════════════════════════════════════════════
//  Routes RH ADMIN (LOT 4) — exécution SERVEUR uniquement (service_role via
//  getServerDb). Toutes les lectures/écritures des tables RH protégées par RLS
//  passent ici : le navigateur n'accède jamais directement à ces tables.
//  (Hardening d'authent admin : à brancher sur le contrôle de session admin de
//  l'app — ici on suit le modèle de confiance existant, identique au reste.)
// ══════════════════════════════════════════════════════════════════════════════

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const { op, args = {} } = body;

  try {
    switch (op) {
      case 'getRhConfig':       return NextResponse.json(await getRhConfigDB());
      case 'saveRhConfig':      return NextResponse.json(await saveRhConfigDB(args.rows));
      case 'getPrimeTypes':     return NextResponse.json(await getPrimeTypesDB());
      case 'createPrimeType':   return NextResponse.json(await createPrimeTypeDB(args));
      case 'updatePrimeType':   return NextResponse.json(await updatePrimeTypeDB(args.id, args.fields));
      case 'deletePrimeType':   return NextResponse.json(await deletePrimeTypeDB(args.id));
      case 'getIncidents':      return NextResponse.json(await getIncidentsForCleanerDB(args.cleanerId));
      case 'getMissionIncidents': return NextResponse.json(await getMissionIncidentsDB(args.missionId));
      case 'createIncident':    return NextResponse.json(await createIncidentDB(args));
      case 'deleteIncident':    return NextResponse.json(await deleteIncidentDB(args.id, args.cleanerId));
      case 'getPrimeRequests':  return NextResponse.json(await getPrimeRequestsDB(args.statut));
      case 'resolvePrimeRequest': return NextResponse.json(await resolvePrimeRequestDB(args.id, args.accept));
      case 'getAllCleanerRh':   return NextResponse.json(await getAllCleanerRhDB());
      default: return NextResponse.json({ error: 'Opération inconnue.' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('api/admin/rh error:', op, e?.message);
    return NextResponse.json({ error: 'Erreur serveur RH.' }, { status: 500 });
  }
}
