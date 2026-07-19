/**
 * GET /api/admin/seed-all-kbs
 * ──────────────────────────────────────────────────────────────
 * One-shot : importe le pack de démarrage (KB seed) pour les 4
 * agents en un seul appel. Protégé par Bearer CRON_SECRET.
 * Idempotent — si une fiche existe déjà (même titre), elle est
 * ignorée. Endpoint destiné à être supprimé après le premier
 * peuplement de production.
 */
import { NextRequest, NextResponse } from "next/server";
import { AGENT_ORDER, addKnowledge, listKnowledge } from "@/lib/agents";
import { SEED_KB } from "@/lib/agent-seed-kb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const results: Record<string, { created: number; skipped: number }> = {};

  for (const slug of AGENT_ORDER) {
    const existing = await listKnowledge(slug).catch(() => []);
    const existingTitles = new Set(existing.map((e) => e.title));
    let created = 0;
    let skipped = 0;
    for (const entry of SEED_KB[slug] || []) {
      if (existingTitles.has(entry.title)) {
        skipped++;
        continue;
      }
      await addKnowledge(slug, entry);
      created++;
    }
    results[slug] = { created, skipped };
  }

  return NextResponse.json({ ok: true, results, ran_at: new Date().toISOString() });
}
