"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query, queryOne, execute } from "@/lib/db";
import { getAgent, logEvent } from "@/lib/agents";
import { generateFromBrief } from "@/lib/marketing-brain";
import { publishInstagramPost } from "@/lib/instagram";
import { transcribeAudioUrl } from "@/lib/voice-transcribe";

// ─── Types partagés ────────────────────────────────────────────────
export type Brief = {
  id: number;
  brief_text: string;
  brief_source: "text" | "voice";
  photo_urls: string[];
  instagram_caption: string | null;
  instagram_hashtags: string | null;
  linkedin_post: string | null;
  blog_title: string | null;
  blog_slug: string | null;
  blog_meta_description: string | null;
  blog_content_md: string | null;
  instagram_status: string;
  instagram_scheduled_for: string | null;
  instagram_published_at: string | null;
  instagram_post_id: string | null;
  instagram_error: string | null;
  instagram_insights: { likes: number; comments: number; reach: number; fetched_at: string } | null;
  instagram_insights_fetched_at: string | null;
  linkedin_status: string;
  linkedin_copied_at: string | null;
  blog_status: string;
  blog_post_id: number | null;
  generation_duration_ms: number | null;
  created_at: string;
  updated_at: string;
};

function revalidate() {
  revalidatePath("/admin/agents/marketing");
}

// ─── Créer + générer un brief ─────────────────────────────────────
export async function createBriefAction(input: {
  brief_text: string;
  brief_source: "text" | "voice";
  photo_urls: string[];
}): Promise<
  | { ok: true; briefId: number }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    const text = input.brief_text.trim();
    if (!text) return { ok: false, error: "Brief vide" };
    if (text.length > 5000)
      return { ok: false, error: "Brief trop long (max 5 000 caractères)" };

    // 1. Génère les 3 drafts avec Claude
    const gen = await generateFromBrief({
      briefText: text,
      photoUrls: input.photo_urls,
    });
    if (!gen.ok) {
      await logEvent("marketing", "brief_generation_error", { error: gen.error }, false);
      return { ok: false, error: gen.error };
    }

    // 2. Persiste le brief avec ses drafts
    const inserted = await queryOne<{ id: number }>(
      `INSERT INTO marketing_briefs (
        brief_text, brief_source, photo_urls,
        instagram_caption, instagram_hashtags,
        linkedin_post,
        blog_title, blog_slug, blog_meta_description, blog_content_md,
        generation_duration_ms
       ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        text,
        input.brief_source,
        JSON.stringify(input.photo_urls),
        gen.instagram.caption,
        gen.instagram.hashtags,
        gen.linkedin,
        gen.blog.title,
        gen.blog.slug,
        gen.blog.meta_description,
        gen.blog.content_markdown,
        gen.duration_ms,
      ]
    );
    if (!inserted?.id) return { ok: false, error: "Insert brief échoué" };

    await logEvent("marketing", "brief_generated", {
      brief_id: inserted.id,
      duration_ms: gen.duration_ms,
      photos: input.photo_urls.length,
    });
    revalidate();
    return { ok: true, briefId: inserted.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Transcription vocal + création brief ──────────────────────────
export async function createBriefFromVoiceAction(input: {
  audio_url: string;
  photo_urls: string[];
}): Promise<
  | { ok: true; briefId: number; transcript: string }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    const inst = await getAgent("marketing");
    const cfg = inst?.config as { openai_api_key?: string } | undefined;
    if (!cfg?.openai_api_key)
      return {
        ok: false,
        error:
          "Clé API OpenAI manquante — configurez-la dans /admin/agents/marketing pour utiliser les briefs vocaux.",
      };

    const t = await transcribeAudioUrl({
      apiKey: cfg.openai_api_key,
      audioUrl: input.audio_url,
      language: "fr",
      prompt: "Photographie de mariage, Mickael Romero, Côte d'Azur, Provence, Nice.",
    });
    if (!t.ok) return { ok: false, error: `Transcription : ${t.error}` };

    const brief = await createBriefAction({
      brief_text: t.text,
      brief_source: "voice",
      photo_urls: input.photo_urls,
    });
    if (!brief.ok) return brief;
    return { ok: true, briefId: brief.briefId, transcript: t.text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Édition d'un draft ───────────────────────────────────────────
export async function updateBriefDraftAction(input: {
  briefId: number;
  platform: "instagram" | "linkedin" | "blog";
  patch: Partial<{
    instagram_caption: string;
    instagram_hashtags: string;
    linkedin_post: string;
    blog_title: string;
    blog_slug: string;
    blog_meta_description: string;
    blog_content_md: string;
  }>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(input.patch)) {
      if (typeof v === "string") {
        sets.push(`${k} = $${i++}`);
        params.push(v);
      }
    }
    if (sets.length === 0) return { ok: false, error: "Rien à mettre à jour" };
    sets.push(`updated_at = NOW()`);
    params.push(input.briefId);
    await execute(
      `UPDATE marketing_briefs SET ${sets.join(", ")} WHERE id = $${i}`,
      params
    );
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Publier sur Instagram ────────────────────────────────────────
export async function publishInstagramAction(
  briefId: number
): Promise<
  | { ok: true; postId: string; facebookWarning?: string }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    const brief = await queryOne<Brief>(
      `SELECT * FROM marketing_briefs WHERE id = $1`,
      [briefId]
    );
    if (!brief) return { ok: false, error: "Brief introuvable" };
    if (!brief.photo_urls || brief.photo_urls.length === 0)
      return { ok: false, error: "Aucune photo attachée au brief" };

    const inst = await getAgent("marketing");
    const cfg = inst?.config as
      | { meta_access_token?: string; instagram_business_id?: string }
      | undefined;
    if (!cfg?.meta_access_token || !cfg?.instagram_business_id)
      return {
        ok: false,
        error:
          "Meta access token ou Instagram business ID manquant — configurez-les dans /admin/agents/marketing.",
      };

    const caption = [
      (brief.instagram_caption || "").trim(),
      (brief.instagram_hashtags || "").trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await publishInstagramPost({
      igUserId: cfg.instagram_business_id,
      accessToken: cfg.meta_access_token,
      imageUrls: brief.photo_urls,
      caption,
    });

    if (!result.ok) {
      await execute(
        `UPDATE marketing_briefs
         SET instagram_status = 'failed', instagram_error = $1, updated_at = NOW()
         WHERE id = $2`,
        [result.error, briefId]
      );
      await logEvent(
        "marketing",
        "instagram_publish_error",
        { brief_id: briefId, error: result.error },
        false
      );
      revalidate();
      return { ok: false, error: result.error };
    }

    await execute(
      `UPDATE marketing_briefs
       SET instagram_status = 'published',
           instagram_post_id = $1,
           instagram_published_at = NOW(),
           instagram_error = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [result.postId, briefId]
    );
    await logEvent("marketing", "instagram_published", {
      brief_id: briefId,
      post_id: result.postId,
    });

    // ─── Bonus : cross-post Facebook Page ────────────────────────
    // Si l'app a un Page ID + Page Access Token en config, on double
    // la visibilité sans effort supplémentaire de rédaction.
    // Best-effort (ne bloque JAMAIS la réponse principale IG).
    let facebookWarning: string | undefined;
    const pageId = (cfg as { meta_page_id?: string }).meta_page_id;
    if (pageId && cfg.meta_access_token) {
      try {
        const { publishFacebookPagePost } = await import("@/lib/instagram");
        const fb = await publishFacebookPagePost({
          pageId,
          pageAccessToken: cfg.meta_access_token,
          imageUrls: brief.photo_urls,
          caption,
        });
        if (fb.ok) {
          await execute(
            `UPDATE marketing_briefs
             SET facebook_post_id = $1, facebook_published_at = NOW(),
                 updated_at = NOW()
             WHERE id = $2`,
            [fb.postId, briefId]
          ).catch(() => {});
          await logEvent(
            "marketing",
            "facebook_cross_posted",
            { brief_id: briefId, post_id: fb.postId },
            true
          );
        } else {
          // On REMONTE l'échec à l'UI au lieu de le cacher : le cross-post
          // Facebook est cassé (token page expiré, page id erroné…).
          facebookWarning = `Publié sur Instagram, mais le cross-post Facebook a échoué : ${fb.error}`;
          await logEvent(
            "marketing",
            "facebook_cross_post_error",
            { brief_id: briefId, error: fb.error },
            false
          );
        }
      } catch (e) {
        facebookWarning =
          "Publié sur Instagram, mais le cross-post Facebook a échoué (erreur technique).";
        console.error("[marketing] fb cross-post failed:", e);
      }
    }

    revalidate();
    return { ok: true, postId: result.postId, facebookWarning };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Programmer un post Instagram pour une date future ───────────
// Passe le statut à 'scheduled' avec une date future. Le cron
// /api/cron/publish-scheduled toutes les 15 min prend le relais.
export async function scheduleInstagramAction(
  briefId: number,
  scheduledForISO: string
): Promise<
  | { ok: true; scheduledFor: string }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    const when = new Date(scheduledForISO);
    if (isNaN(when.getTime()))
      return { ok: false, error: "Date invalide" };
    if (when.getTime() < Date.now() + 60_000)
      return {
        ok: false,
        error:
          "La date doit être au moins 1 min dans le futur (le cron passe toutes les 15 min).",
      };

    const brief = await queryOne<Brief>(
      `SELECT * FROM marketing_briefs WHERE id = $1`,
      [briefId]
    );
    if (!brief) return { ok: false, error: "Brief introuvable" };
    if (!brief.photo_urls || brief.photo_urls.length === 0)
      return { ok: false, error: "Aucune photo — impossible de programmer" };
    if (brief.instagram_status === "published")
      return { ok: false, error: "Déjà publié" };

    await execute(
      `UPDATE marketing_briefs
       SET instagram_status = 'scheduled',
           instagram_scheduled_for = $1,
           instagram_error = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [when.toISOString(), briefId]
    );
    await logEvent("marketing", "instagram_scheduled", {
      brief_id: briefId,
      scheduled_for: when.toISOString(),
    });
    revalidate();
    return { ok: true, scheduledFor: when.toISOString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function cancelScheduledInstagramAction(
  briefId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    await execute(
      `UPDATE marketing_briefs
       SET instagram_status = 'draft',
           instagram_scheduled_for = NULL,
           updated_at = NOW()
       WHERE id = $1 AND instagram_status = 'scheduled'`,
      [briefId]
    );
    await logEvent("marketing", "instagram_schedule_cancelled", {
      brief_id: briefId,
    });
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Traite les posts programmés en retard (appelé par le cron) ───
// Sélectionne tous les briefs 'scheduled' dont la date est dépassée,
// publie chacun via publishInstagramAction. Renvoie un résumé.
// Aucune auth requise pour l'appelant : la protection se fait via
// CRON_SECRET dans le header (voir /api/cron/publish-scheduled).
export async function processScheduledInstagramPosts(): Promise<{
  processed: number;
  published: number;
  failed: number;
  details: Array<{ briefId: number; ok: boolean; error?: string }>;
}> {
  // Filet : un brief coincé en 'publishing' depuis >15 min = process
  // interrompu (timeout Vercel). On le repasse 'failed' pour qu'il soit
  // visible plutôt que bloqué invisible (et jamais re-publié en double).
  await execute(
    `UPDATE marketing_briefs
       SET instagram_status = 'failed',
           instagram_error = 'Publication interrompue (timeout) — reprogramme si besoin',
           updated_at = NOW()
     WHERE instagram_status = 'publishing'
       AND updated_at < NOW() - INTERVAL '15 minutes'`
  ).catch(() => {});

  // CLAIM ATOMIQUE : on bascule d'un coup les briefs dus 'scheduled' →
  // 'publishing' et on récupère la liste via RETURNING. Une invocation cron
  // concurrente (chevauchement, retry Vercel) ne verra plus aucun brief
  // 'scheduled' à traiter → plus de double-publication Instagram.
  const due = await query<Brief>(
    `UPDATE marketing_briefs
       SET instagram_status = 'publishing', updated_at = NOW()
     WHERE id IN (
       SELECT id FROM marketing_briefs
       WHERE instagram_status = 'scheduled'
         AND instagram_scheduled_for IS NOT NULL
         AND instagram_scheduled_for <= NOW()
       ORDER BY instagram_scheduled_for ASC
       LIMIT 20
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`
  );

  const details: Array<{ briefId: number; ok: boolean; error?: string }> = [];
  let published = 0;
  let failed = 0;

  for (const brief of due) {
    // Réutilise la fonction interne pour publier — on peut la factoriser
    // en dupliquant l'appel car publishInstagramAction requiert auth.
    // On la déblaie ici en appelant directement l'API Instagram.
    const inst = await getAgent("marketing");
    const cfg = inst?.config as
      | { meta_access_token?: string; instagram_business_id?: string }
      | undefined;
    if (!cfg?.meta_access_token || !cfg?.instagram_business_id) {
      details.push({
        briefId: brief.id,
        ok: false,
        error: "Meta creds manquants",
      });
      failed++;
      continue;
    }

    const { publishInstagramPost } = await import("@/lib/instagram");
    const caption = [
      (brief.instagram_caption || "").trim(),
      (brief.instagram_hashtags || "").trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await publishInstagramPost({
      igUserId: cfg.instagram_business_id,
      accessToken: cfg.meta_access_token,
      imageUrls: brief.photo_urls,
      caption,
    });

    if (!result.ok) {
      await execute(
        `UPDATE marketing_briefs
         SET instagram_status = 'failed', instagram_error = $1, updated_at = NOW()
         WHERE id = $2`,
        [result.error, brief.id]
      );
      await logEvent(
        "marketing",
        "instagram_scheduled_publish_error",
        { brief_id: brief.id, error: result.error },
        false
      );
      details.push({ briefId: brief.id, ok: false, error: result.error });
      failed++;
    } else {
      await execute(
        `UPDATE marketing_briefs
         SET instagram_status = 'published',
             instagram_post_id = $1,
             instagram_published_at = NOW(),
             instagram_error = NULL,
             updated_at = NOW()
         WHERE id = $2`,
        [result.postId, brief.id]
      );
      await logEvent("marketing", "instagram_scheduled_published", {
        brief_id: brief.id,
        post_id: result.postId,
      });
      details.push({ briefId: brief.id, ok: true });
      published++;
    }
  }

  revalidate();
  return { processed: due.length, published, failed, details };
}

// ─── Meta Insights : rafraîchit les stats d'un post publié ──────
export async function refreshInstagramInsightsAction(
  briefId: number
): Promise<
  | { ok: true; likes: number; comments: number; reach: number }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    const brief = await queryOne<Brief>(
      `SELECT * FROM marketing_briefs WHERE id = $1`,
      [briefId]
    );
    if (!brief) return { ok: false, error: "Brief introuvable" };
    if (!brief.instagram_post_id)
      return { ok: false, error: "Aucun post publié pour ce brief" };

    const inst = await getAgent("marketing");
    const cfg = inst?.config as { meta_access_token?: string } | undefined;
    if (!cfg?.meta_access_token)
      return { ok: false, error: "Meta access token manquant" };

    const { fetchInstagramInsights } = await import("@/lib/instagram");
    const res = await fetchInstagramInsights({
      postId: brief.instagram_post_id,
      accessToken: cfg.meta_access_token,
    });
    if (!res.ok) return { ok: false, error: res.error };

    await execute(
      `UPDATE marketing_briefs
       SET instagram_insights = $1::jsonb,
           instagram_insights_fetched_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(res.insights), briefId]
    );
    await logEvent("marketing", "instagram_insights_refreshed", {
      brief_id: briefId,
      likes: res.insights.likes,
      comments: res.insights.comments,
      reach: res.insights.reach,
    });
    revalidate();
    return {
      ok: true,
      likes: res.insights.likes,
      comments: res.insights.comments,
      reach: res.insights.reach,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── LinkedIn : marque comme copié (pas de publication auto) ──────
export async function markLinkedInCopiedAction(
  briefId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    await execute(
      `UPDATE marketing_briefs
       SET linkedin_status = 'copied', linkedin_copied_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [briefId]
    );
    await logEvent("marketing", "linkedin_copied", { brief_id: briefId });
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Publier sur le blog (nouveau post dans public.posts) ─────────
export async function publishBlogAction(
  briefId: number
): Promise<
  | { ok: true; postId: number; slug: string }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    const brief = await queryOne<Brief>(
      `SELECT * FROM marketing_briefs WHERE id = $1`,
      [briefId]
    );
    if (!brief) return { ok: false, error: "Brief introuvable" };
    if (!brief.blog_title || !brief.blog_content_md)
      return { ok: false, error: "Article de blog vide" };

    // Slug unique : si collision, on ajoute -2, -3, etc.
    let slug = brief.blog_slug || slugify(brief.blog_title);
    let attempt = 0;
    while (true) {
      const existing = await queryOne<{ id: number }>(
        `SELECT id FROM posts WHERE slug = $1`,
        [slug]
      );
      if (!existing) break;
      attempt += 1;
      slug = `${brief.blog_slug}-${attempt + 1}`;
      if (attempt > 10) return { ok: false, error: "Impossible de générer un slug unique" };
    }

    // Excerpt : première ligne de la méta-desc si dispo, sinon 200 premiers
    // caractères du contenu.
    const excerpt =
      brief.blog_meta_description ||
      brief.blog_content_md.replace(/[#*_`>-]/g, "").trim().slice(0, 200);

    // Cover : première photo du brief si dispo (nom du fichier extrait
    // de l'URL). La table stocke un cover_filename qui pointe vers une
    // image déjà uploadée dans /uploads/.
    const coverFilename =
      brief.photo_urls?.[0] && brief.photo_urls[0].includes("/uploads/")
        ? brief.photo_urls[0].split("/uploads/")[1]
        : null;

    // Mots par minute pour l'estimation de lecture (250 wpm)
    const wordCount = (brief.blog_content_md.match(/\S+/g) || []).length;
    const readMinutes = Math.max(1, Math.round(wordCount / 250));

    // Date de publication ISO (format simple, cohérent avec les autres
    // posts qui stockent un TEXT).
    const today = new Date().toISOString().slice(0, 10);

    // Insert : published=0 par défaut (brouillon), le photographe passe
    // en publié depuis /admin/posts après relecture.
    const inserted = await queryOne<{ id: number }>(
      `INSERT INTO posts (
        slug, title_fr, title_en, category, excerpt_fr, excerpt_en,
        body_fr, body_en, cover_filename, published_at, read_minutes,
        published, sort_order
       ) VALUES ($1, $2, '', 'journal', $3, '', $4, '', $5, $6, $7, 0, 0)
       RETURNING id`,
      [
        slug,
        brief.blog_title,
        excerpt,
        brief.blog_content_md,
        coverFilename,
        today,
        readMinutes,
      ]
    );
    if (!inserted?.id) return { ok: false, error: "Insert blog échoué" };

    await execute(
      `UPDATE marketing_briefs
       SET blog_status = 'draft', blog_post_id = $1, blog_slug = $2, updated_at = NOW()
       WHERE id = $3`,
      [inserted.id, slug, briefId]
    );
    await logEvent("marketing", "blog_draft_created", {
      brief_id: briefId,
      post_id: inserted.id,
      slug,
    });
    revalidate();
    revalidatePath("/blog");
    revalidatePath("/admin/posts");
    return { ok: true, postId: inserted.id, slug };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Régénérer les drafts (garde le brief, écrase les drafts) ─────
export async function regenerateDraftsAction(
  briefId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const brief = await queryOne<Brief>(
      `SELECT * FROM marketing_briefs WHERE id = $1`,
      [briefId]
    );
    if (!brief) return { ok: false, error: "Brief introuvable" };

    const gen = await generateFromBrief({
      briefText: brief.brief_text,
      photoUrls: brief.photo_urls || [],
    });
    if (!gen.ok) return { ok: false, error: gen.error };

    await execute(
      `UPDATE marketing_briefs SET
        instagram_caption = $1,
        instagram_hashtags = $2,
        linkedin_post = $3,
        blog_title = $4,
        blog_slug = $5,
        blog_meta_description = $6,
        blog_content_md = $7,
        generation_duration_ms = $8,
        updated_at = NOW()
       WHERE id = $9`,
      [
        gen.instagram.caption,
        gen.instagram.hashtags,
        gen.linkedin,
        gen.blog.title,
        gen.blog.slug,
        gen.blog.meta_description,
        gen.blog.content_markdown,
        gen.duration_ms,
        briefId,
      ]
    );
    await logEvent("marketing", "brief_regenerated", { brief_id: briefId });
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Suppression d'un brief ───────────────────────────────────────
export async function deleteBriefAction(
  briefId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    await execute(`DELETE FROM marketing_briefs WHERE id = $1`, [briefId]);
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Lecture ──────────────────────────────────────────────────────
export async function listBriefsForAdmin(limit = 40): Promise<Brief[]> {
  return query<Brief>(
    `SELECT * FROM marketing_briefs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
}

export async function getBriefForAdmin(id: number): Promise<Brief | null> {
  return queryOne<Brief>(`SELECT * FROM marketing_briefs WHERE id = $1`, [id]);
}

// Fallback slug si la brain a échoué à en générer un
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
