/**
 * GET /api/cron/refresh-ig-insights
 * ──────────────────────────────────
 * Cron toutes les 6 h qui rafraîchit les insights (likes/reach/comments)
 * des posts Instagram publiés dans les 30 derniers jours.
 *
 * Meta ne délivre pas les insights immédiatement : likes/comments/reach
 * ne se stabilisent qu'après quelques heures. On refresh en boucle
 * jusqu'à 30 j après publication, puis on arrête (les stats
 * n'évoluent quasi plus au-delà).
 */
import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { getSharedConfig } from "@/lib/studio-settings";
import { fetchInstagramInsights } from "@/lib/instagram";
import { logEvent } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const shared = await getSharedConfig().catch(
    () => ({} as Record<string, string>)
  );
  const accessToken = shared.meta_access_token;
  if (!accessToken) {
    return NextResponse.json({ ok: true, skipped: "no_token" });
  }

  // Posts publiés dans les 30 derniers jours, avec un post_id Meta
  const rows = await query<{
    id: number;
    instagram_post_id: string;
    published_at: string;
  }>(
    `SELECT id, instagram_post_id, instagram_published_at as published_at
     FROM marketing_briefs
     WHERE instagram_status = 'published'
       AND instagram_post_id IS NOT NULL
       AND instagram_published_at >= NOW() - INTERVAL '30 days'
     ORDER BY instagram_published_at DESC
     LIMIT 60`
  ).catch(() => []);

  let refreshed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const r = await fetchInstagramInsights({
        postId: row.instagram_post_id,
        accessToken,
      });
      if (!r.ok) {
        failed++;
        errors.push(`${row.id}: ${r.error}`);
        continue;
      }
      await execute(
        `UPDATE marketing_briefs
         SET instagram_insights = $1::jsonb,
             instagram_insights_fetched_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(r.insights), row.id]
      ).catch(() => {});
      refreshed++;
    } catch (e) {
      failed++;
      errors.push(`${row.id}: ${e instanceof Error ? e.message : "?"}`);
    }
  }

  await logEvent(
    "marketing",
    "ig_insights_refreshed",
    { checked: rows.length, refreshed, failed },
    failed === 0
  );

  return NextResponse.json({
    ok: true,
    checked: rows.length,
    refreshed,
    failed,
    errors: errors.slice(0, 10),
  });
}
