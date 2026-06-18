// Scan French content in posts (title, excerpt, body) for typography issues.
import pg from "pg";
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const r = await c.query("SELECT id, slug, title_fr, excerpt_fr, body_fr FROM posts ORDER BY id");

for (const p of r.rows) {
  console.log(`POST ${p.id} (${p.slug}):`);
  const fields = [
    ["title_fr", p.title_fr || ""],
    ["excerpt_fr", p.excerpt_fr || ""],
    ["body_fr", p.body_fr || ""],
  ];
  for (const [name, txt] of fields) {
    const issues = [];
    if (txt !== txt.trim()) issues.push("leading/trailing whitespace");
    if (/  +/.test(txt)) issues.push(`${txt.match(/  +/g).length} double spaces`);
    if (/\.\.\./.test(txt)) issues.push(`${(txt.match(/\.\.\./g) || []).length} '...' (should be …)`);
    if (/\bA propos\b/.test(txt)) issues.push("A propos → À propos");
    if (/\bA partir\b/.test(txt)) issues.push("A partir → À partir");
    if (/\bEvenement/i.test(txt)) issues.push("Evenement → Événement");
    if (/\boeuvre/i.test(txt)) issues.push("oeuvre → œuvre");
    if (/\bcoeur/i.test(txt)) issues.push("coeur → cœur");
    if (/\bEte\b/.test(txt)) issues.push("Ete → Été");
    if (issues.length) {
      console.log(`  ${name}: ${issues.join("; ")}`);
    }
  }
}

await c.end();
