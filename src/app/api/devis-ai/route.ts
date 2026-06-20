import { NextResponse } from 'next/server';
import { getTarifsDB } from '@/lib/devis';

// ══════════════════════════════════════════════════════════════════════════════
//  Devis intelligent par IA (LOT 8B) — route SERVEUR uniquement.
//  La clé ANTHROPIC_API_KEY reste secrète (variable d'environnement Vercel).
//  L'IA ne fait que STRUCTURER : les prix viennent TOUJOURS de la table `tarifs`,
//  jamais inventés. Total recalculé côté app. En cas d'échec → l'admin saisit à la main.
// ══════════════════════════════════════════════════════════════════════════════

export const runtime = 'nodejs';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-8';

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'IA non configurée (ANTHROPIC_API_KEY manquante).' }, { status: 200 });
  }

  let description = '';
  try {
    const body = await req.json();
    description = String(body?.description ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  if (!description) return NextResponse.json({ error: 'Décris la prestation.' }, { status: 200 });

  // Grille tarifaire active = seule référence de prix autorisée.
  const tarifs = (await getTarifsDB(true));
  if (tarifs.length === 0) return NextResponse.json({ error: 'Aucun tarif actif dans la grille.' }, { status: 200 });

  const grid = tarifs.map(t => `- ${t.nom} (${t.unite}) : ${t.prix}€`).join('\n');
  const prompt = `Tu es un assistant de devis pour une société de nettoyage.
À partir de la description du client et de la GRILLE TARIFAIRE ci-dessous, sélectionne les prestations pertinentes et leurs quantités.
N'invente AUCUN prix ni aucune prestation hors grille.
Réponds UNIQUEMENT par un JSON valide, sans texte autour, de la forme :
{"lignes":[{"nom":"<nom exact de la grille>","quantite":<entier>}]}

GRILLE TARIFAIRE :
${grid}

DESCRIPTION DU CLIENT :
${description}`;

  let aiText = '';
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
      // Garde-fou anti-timeout
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error('devis-ai anthropic error:', res.status, await res.text());
      return NextResponse.json({ error: 'L’IA est indisponible, saisis le devis à la main.' }, { status: 200 });
    }
    const data = await res.json();
    aiText = (data?.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
  } catch (e) {
    console.error('devis-ai fetch error:', e);
    return NextResponse.json({ error: 'L’IA n’a pas répondu, saisis le devis à la main.' }, { status: 200 });
  }

  // Parse robuste : on extrait le 1er objet JSON même si le modèle ajoute du texte.
  let parsed: any;
  try {
    const match = aiText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : aiText);
  } catch {
    return NextResponse.json({ error: 'Réponse IA illisible, saisis le devis à la main.' }, { status: 200 });
  }

  // Reconstruction des lignes À PARTIR DE LA GRILLE (prix de la base, jamais de l'IA).
  const byName = new Map(tarifs.map(t => [t.nom.toLowerCase(), t]));
  const lignes = (Array.isArray(parsed?.lignes) ? parsed.lignes : [])
    .map((l: any) => {
      const tarif = byName.get(String(l?.nom ?? '').toLowerCase().trim());
      if (!tarif) return null;
      const quantite = Math.max(1, Math.round(Number(l?.quantite) || 1));
      return { nom: tarif.nom, quantite, prix_unitaire: tarif.prix, total: Math.round(tarif.prix * quantite * 100) / 100 };
    })
    .filter(Boolean);

  if (lignes.length === 0) return NextResponse.json({ error: 'Aucune prestation reconnue, saisis le devis à la main.' }, { status: 200 });
  return NextResponse.json({ lignes }, { status: 200 });
}
