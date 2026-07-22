import pg from "pg";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.diag", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(`SELECT key, value FROM studio_settings ORDER BY key`);
console.log("=== studio_settings ===");
for (const row of r.rows) {
  const v = row.value.length > 60 ? row.value.slice(0, 60) + "..." : row.value;
  console.log(`  ${row.key} = ${v}`);
}
const a = await c.query(`SELECT slug, config FROM agent_installations WHERE slug='admin'`);
console.log("\n=== admin agent config (raw) ===");
if (a.rows[0]) {
  for (const [k, v] of Object.entries(a.rows[0].config || {})) {
    const vs = String(v).length > 60 ? String(v).slice(0, 60) + "..." : String(v);
    console.log(`  ${k} = ${vs}`);
  }
} else {
  console.log("  (no admin agent installed)");
}
await c.end();
