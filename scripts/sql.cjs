// Exécute un fichier SQL (ou une requête) sur la base de production.
//
//   node scripts/sql.cjs supabase/migration_xxx.sql
//   node scripts/sql.cjs "select count(*) from missions"
//
// L'adresse vient de SUPABASE_DB_URL dans .env.local (jamais versionné) et
// n'est jamais affichée. Connexion DIRECTE à la base : le « pooler » de
// Supabase bloque temporairement après quelques échecs d'authentification.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.join(__dirname, '..', '.env.local');
const url = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  .find(l => l.startsWith('SUPABASE_DB_URL='))?.slice('SUPABASE_DB_URL='.length).trim();
if (!url) { console.error('SUPABASE_DB_URL absent de .env.local'); process.exit(1); }

const m = url.match(/^postgres(?:ql)?:\/\/postgres\.([a-z0-9]+):([^@]+)@/);
const direct = m ? `postgresql://postgres:${m[2]}@db.${m[1]}.supabase.co:5432/postgres` : url;

const arg = process.argv[2];
if (!arg) { console.error('Usage : node scripts/sql.cjs <fichier.sql | "requête">'); process.exit(1); }
const sql = fs.existsSync(arg) ? fs.readFileSync(arg, 'utf8') : arg;

(async () => {
  const c = new Client({ connectionString: direct, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  try {
    await c.connect();
    const r = await c.query(sql);
    for (const x of Array.isArray(r) ? r : [r]) {
      if (x.rows?.length) console.table(x.rows); else console.log(x.command, x.rowCount ?? '');
    }
  } catch (e) {
    console.error('ERREUR:', e.message.replace(/postgres(ql)?:\/\/\S+/g, '[url]'));
    process.exitCode = 1;
  } finally {
    await c.end().catch(() => {});
  }
})();
