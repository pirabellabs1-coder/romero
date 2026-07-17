// One-shot: applique la migration `agent_installations` sur Supabase.
// Idempotent — safe si déjà exécuté.
// Usage : DATABASE_URL="..." node scripts/run-agents-migration.mjs
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}

const SQL = `
CREATE TABLE IF NOT EXISTS public.agent_installations (
  slug          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'not_installed'
                CHECK (status IN ('not_installed','installing','installed','error','paused')),
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  installed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.agent_installations (slug, name) VALUES
  ('site',      'Agent site — chatbot & prise de RDV'),
  ('whatsapp',  'Assistant WhatsApp + Agenda'),
  ('marketing', 'Agent Marketing — IG / LinkedIn / Blog'),
  ('admin',     'Agent Administratif & Juridique')
ON CONFLICT (slug) DO NOTHING;
`;

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await pool.query(SQL);
  const { rows } = await pool.query(
    "SELECT slug, name, status FROM public.agent_installations ORDER BY slug"
  );
  console.log("✓ Migration appliquée. Agents en base :");
  for (const r of rows) console.log(`  - ${r.slug.padEnd(10)} ${r.status.padEnd(15)} ${r.name}`);
} catch (e) {
  console.error("✗ Erreur :", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
