/**
 * Import du seed v3 des 4 agents dans la DB.
 * Usage : node supabase/seeds/import-agents-v3.js "postgres://..."
 *
 * Écrase la KB actuelle + prompts avec la version v3 depuis
 * ./agents-v3.json. Idempotent : re-runnable.
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

(async () => {
  if (!process.argv[2]) {
    console.error("Usage: node import-agents-v3.js <DATABASE_URL>");
    process.exit(1);
  }

  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, "agents-v3.json"), "utf8")
  );

  const c = new Client({
    connectionString: process.argv[2],
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  console.log("Connecté à la DB");

  for (const [slug, payload] of Object.entries(data)) {
    // Update prompt système
    await c.query(
      `UPDATE agent_installations SET system_prompt = $1, updated_at = NOW()
       WHERE slug = $2`,
      [payload.system_prompt, slug]
    );

    // Purge + insert KB
    await c.query(`DELETE FROM agent_knowledge WHERE agent_slug = $1`, [slug]);
    for (const fiche of payload.kb) {
      await c.query(
        `INSERT INTO agent_knowledge (agent_slug, title, content, category)
         VALUES ($1, $2, $3, $4)`,
        [slug, fiche.title, fiche.content, fiche.category]
      );
    }
    console.log(
      `✓ ${slug}: prompt ${payload.system_prompt.length} chars + ${payload.kb.length} fiches KB`
    );
  }

  await c.end();
  console.log("\n✓ Import v3 terminé");
})();
