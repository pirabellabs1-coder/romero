import pg from "pg";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.diag", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) process.env[m[1]] = m[2];
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  `SELECT page, key, value FROM page_content
   WHERE key LIKE '%hero%' OR key LIKE '%photo%'
   ORDER BY page, key LIMIT 30`
);
for (const row of r.rows) {
  console.log(`${row.page.padEnd(12)} ${row.key.padEnd(24)} ${String(row.value).slice(0, 90)}`);
}
await c.end();
