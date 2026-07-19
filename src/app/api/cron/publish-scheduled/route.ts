/**
 * GET /api/cron/publish-scheduled
 * ─────────────────────────────────────────────────────────────
 * Endpoint appelé par Vercel Cron toutes les 15 minutes pour
 * publier les posts Instagram programmés dont l'heure est venue.
 *
 * Sécurité :
 *   Vercel Cron injecte automatiquement un header
 *   `Authorization: Bearer <CRON_SECRET>` (variable d'env sur le
 *   projet). On refuse toute requête sans cette valeur.
 *
 *   En développement (pas de CRON_SECRET), on log un warning mais
 *   on laisse passer pour permettre les tests manuels.
 *
 * Idempotence :
 *   Un post 'scheduled' passe à 'published' ou 'failed' dès qu'il
 *   est traité. Deux appels rapprochés du cron ne peuvent pas
 *   publier deux fois le même post (le WHERE filter exclut les
 *   statuts terminaux).
 */
import { NextRequest, NextResponse } from "next/server";
import { processScheduledInstagramPosts } from "@/app/admin/(panel)/agents/marketing-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";

  if (secret) {
    const expected = `Bearer ${secret}`;
    if (authHeader !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  } else {
    console.warn(
      "[cron/publish-scheduled] CRON_SECRET non défini — requête acceptée sans vérification (dev only)."
    );
  }

  try {
    const result = await processScheduledInstagramPosts();
    return NextResponse.json({
      ok: true,
      ...result,
      ran_at: new Date().toISOString(),
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[cron/publish-scheduled]", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
