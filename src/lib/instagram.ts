// ──────────────────────────────────────────────────────────────────────
// Meta Graph API — publication Instagram Business
// ──────────────────────────────────────────────────────────────────────
//
// Contexte : depuis 2018, la publication automatique sur Instagram
// est réservée aux comptes en mode « Business » liés à une Page
// Facebook, via la Graph API. Aucune alternative légale.
//
// Endpoints utilisés (v22.0) :
//   POST /{ig-user-id}/media           → crée un container (single ou carousel)
//   POST /{ig-user-id}/media_publish   → publie le container
//
// Design :
//   - Aucune dépendance externe (fetch natif)
//   - Toutes les erreurs sont typées : { ok:true, ... } | { ok:false, error }
//   - Un helper unique publishPost() abstrait le flow 2 étapes de Meta
//   - Support single image ET carousel (2-10 photos)
//
// Contraintes Meta à respecter :
//   - Photos URL publiquement accessibles (Vercel Blob, Supabase Storage ok)
//   - JPEG uniquement (pas de PNG en 2027)
//   - Ratio 4:5 à 1.91:1 (portrait, carré ou paysage — jamais très vertical)
//   - Caption : 2200 caractères max, 30 hashtags max
//   - Une publication toutes les ~1 minute max (rate limit Meta)

const META_GRAPH_BASE = "https://graph.facebook.com/v22.0";

// ─── Types ──────────────────────────────────────────────────────────
export type MetaError = {
  message?: string;
  type?: string;
  code?: number;
  fbtrace_id?: string;
};

export type MediaContainer = {
  id: string;
};

export type PublishedPost = {
  id: string;
  permalink?: string;
};

// ─── Helper fetch avec gestion d'erreur Meta ────────────────────────
async function graphFetch(
  path: string,
  init: RequestInit & { accessToken: string }
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }
> {
  try {
    const url = `${META_GRAPH_BASE}${path}`;
    const resp = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        authorization: `Bearer ${init.accessToken}`,
      },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const err = (data as { error?: MetaError }).error;
      const msg = err?.message ?? `HTTP ${resp.status}`;
      const trace = err?.fbtrace_id ? ` (trace: ${err.fbtrace_id})` : "";
      return { ok: false, error: `${msg}${trace}` };
    }
    return { ok: true, data: data as Record<string, unknown> };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ─── Étape 1 : créer un container média ────────────────────────────
export async function createMediaContainer(input: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption?: string;
  isCarouselItem?: boolean;
}): Promise<
  | { ok: true; container: MediaContainer }
  | { ok: false; error: string }
> {
  const body = new URLSearchParams({
    image_url: input.imageUrl,
    ...(input.caption ? { caption: input.caption } : {}),
    ...(input.isCarouselItem ? { is_carousel_item: "true" } : {}),
  });
  const r = await graphFetch(`/${input.igUserId}/media`, {
    method: "POST",
    accessToken: input.accessToken,
    body,
  });
  if (!r.ok) return r;
  const id = (r.data as { id?: string }).id;
  if (!id) return { ok: false, error: "Container créé sans id (réponse Meta inattendue)" };
  return { ok: true, container: { id } };
}

export async function createCarouselContainer(input: {
  igUserId: string;
  accessToken: string;
  childrenIds: string[];
  caption?: string;
}): Promise<
  | { ok: true; container: MediaContainer }
  | { ok: false; error: string }
> {
  if (input.childrenIds.length < 2 || input.childrenIds.length > 10) {
    return { ok: false, error: "Un carousel doit contenir 2 à 10 items" };
  }
  const body = new URLSearchParams({
    media_type: "CAROUSEL",
    children: input.childrenIds.join(","),
    ...(input.caption ? { caption: input.caption } : {}),
  });
  const r = await graphFetch(`/${input.igUserId}/media`, {
    method: "POST",
    accessToken: input.accessToken,
    body,
  });
  if (!r.ok) return r;
  const id = (r.data as { id?: string }).id;
  if (!id) return { ok: false, error: "Container carousel créé sans id" };
  return { ok: true, container: { id } };
}

// ─── Étape 2 : publier le container ────────────────────────────────
export async function publishContainer(input: {
  igUserId: string;
  accessToken: string;
  containerId: string;
}): Promise<
  | { ok: true; post: PublishedPost }
  | { ok: false; error: string }
> {
  const body = new URLSearchParams({ creation_id: input.containerId });
  const r = await graphFetch(`/${input.igUserId}/media_publish`, {
    method: "POST",
    accessToken: input.accessToken,
    body,
  });
  if (!r.ok) return r;
  const id = (r.data as { id?: string }).id;
  if (!id) return { ok: false, error: "Publish sans id (réponse Meta inattendue)" };
  return { ok: true, post: { id } };
}

// ─── Helper de haut niveau : publie un post en une fonction ────────
export async function publishInstagramPost(input: {
  igUserId: string;
  accessToken: string;
  imageUrls: string[];
  caption: string;
}): Promise<
  | { ok: true; postId: string; permalink?: string }
  | { ok: false; error: string }
> {
  if (input.imageUrls.length === 0)
    return { ok: false, error: "Au moins une photo est requise" };

  const cap = trimCaption(input.caption);

  // Single image → 1 container + publish
  if (input.imageUrls.length === 1) {
    const container = await createMediaContainer({
      igUserId: input.igUserId,
      accessToken: input.accessToken,
      imageUrl: input.imageUrls[0],
      caption: cap,
    });
    if (!container.ok) return container;

    // Meta requiert parfois un délai avant publish (container en cours
    // d'ingestion). On tente 3× avec backoff sur erreur 9004/Container
    // not ready.
    const publish = await publishWithRetry({
      igUserId: input.igUserId,
      accessToken: input.accessToken,
      containerId: container.container.id,
    });
    if (!publish.ok) return publish;
    return { ok: true, postId: publish.post.id };
  }

  // Carousel → 1 container par item, puis container carousel, puis publish
  const children: string[] = [];
  for (const url of input.imageUrls) {
    const c = await createMediaContainer({
      igUserId: input.igUserId,
      accessToken: input.accessToken,
      imageUrl: url,
      isCarouselItem: true,
    });
    if (!c.ok) return { ok: false, error: `Ajout carousel : ${c.error}` };
    children.push(c.container.id);
  }
  const carousel = await createCarouselContainer({
    igUserId: input.igUserId,
    accessToken: input.accessToken,
    childrenIds: children,
    caption: cap,
  });
  if (!carousel.ok) return carousel;

  const publish = await publishWithRetry({
    igUserId: input.igUserId,
    accessToken: input.accessToken,
    containerId: carousel.container.id,
  });
  if (!publish.ok) return publish;
  return { ok: true, postId: publish.post.id };
}

async function publishWithRetry(input: {
  igUserId: string;
  accessToken: string;
  containerId: string;
}): Promise<
  | { ok: true; post: PublishedPost }
  | { ok: false; error: string }
> {
  const delays = [1000, 3000, 5000];
  let lastError = "";
  for (const delay of delays) {
    const r = await publishContainer(input);
    if (r.ok) return r;
    lastError = r.error;
    // Ne retry que si l'erreur ressemble à un container pas prêt.
    if (!/9004|not ready|being processed|EROFS/i.test(r.error)) break;
    await new Promise((res) => setTimeout(res, delay));
  }
  return { ok: false, error: lastError };
}

// Coupe la caption à 2200 caractères sans casser un mot au milieu.
function trimCaption(s: string): string {
  const MAX = 2200;
  if (s.length <= MAX) return s;
  const cut = s.slice(0, MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 2000 ? cut.slice(0, lastSpace) + "…" : cut + "…";
}

// ─── Publication Story (24h) ──────────────────────────────────────
// Meta endpoint : POST /{ig-id}/media avec media_type=STORIES
// Formats acceptés :
//   - Image : JPEG, max 8 Mo, 9:16 recommandé
//   - Video : MP4/MOV, 3-60 sec, 9:16, ≤ 100 Mo
export async function publishInstagramStory(input: {
  igUserId: string;
  accessToken: string;
  mediaUrl: string;
  isVideo?: boolean;
}): Promise<
  | { ok: true; postId: string }
  | { ok: false; error: string }
> {
  const body = new URLSearchParams({
    media_type: "STORIES",
    ...(input.isVideo
      ? { video_url: input.mediaUrl }
      : { image_url: input.mediaUrl }),
  });
  const container = await graphFetch(`/${input.igUserId}/media`, {
    method: "POST",
    accessToken: input.accessToken,
    body,
  });
  if (!container.ok) return container;
  const containerId = (container.data as { id?: string }).id;
  if (!containerId) return { ok: false, error: "Container Story sans id" };

  // Meta demande souvent 5-10s pour ingérer une vidéo Story
  await new Promise((res) => setTimeout(res, input.isVideo ? 8000 : 1500));

  const publish = await publishWithRetry({
    igUserId: input.igUserId,
    accessToken: input.accessToken,
    containerId,
  });
  if (!publish.ok) return publish;
  return { ok: true, postId: publish.post.id };
}

// ─── Publication Reel (video) ────────────────────────────────────
// Meta endpoint : POST /{ig-id}/media avec media_type=REELS
// Contraintes strictes :
//   - MP4 uniquement, codec H.264, audio AAC
//   - Durée : 3-90 secondes
//   - Ratio 9:16 recommandé (obligatoire pour affichage plein écran)
//   - Résolution min 720x1280, max ~4K
export async function publishInstagramReel(input: {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
  coverUrl?: string; // miniature JPEG optionnelle
}): Promise<
  | { ok: true; postId: string }
  | { ok: false; error: string }
> {
  const cap = trimCaption(input.caption);
  const body = new URLSearchParams({
    media_type: "REELS",
    video_url: input.videoUrl,
    caption: cap,
    ...(input.coverUrl ? { cover_url: input.coverUrl } : {}),
  });
  const container = await graphFetch(`/${input.igUserId}/media`, {
    method: "POST",
    accessToken: input.accessToken,
    body,
  });
  if (!container.ok) return container;
  const containerId = (container.data as { id?: string }).id;
  if (!containerId) return { ok: false, error: "Container Reel sans id" };

  // Les Reels demandent plus de temps d'ingestion (transcodage vidéo Meta).
  // On check le status via /media?fields=status_code toutes les 3s, max 60s.
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    await new Promise((res) => setTimeout(res, 3000));
    try {
      const check = await fetch(
        `${META_GRAPH_BASE}/${containerId}?fields=status_code&access_token=${input.accessToken}`
      );
      if (!check.ok) continue;
      const j = (await check.json()) as { status_code?: string };
      if (j.status_code === "FINISHED") break;
      if (j.status_code === "ERROR")
        return { ok: false, error: "Meta transcodage a échoué" };
    } catch {
      /* on continue */
    }
  }

  const publish = await publishWithRetry({
    igUserId: input.igUserId,
    accessToken: input.accessToken,
    containerId,
  });
  if (!publish.ok) return publish;
  return { ok: true, postId: publish.post.id };
}

// ─── Cross-post Facebook Page ─────────────────────────────────────
// Publie une photo (ou un lot) sur la Page Facebook liée à l'IG
// Business. Utile pour toucher deux plateformes avec un seul brief.
//
// Endpoint : POST /{page-id}/photos avec url + caption + published=true
// Pour un carrousel : uploader chaque photo en "unpublished" puis POST
// /{page-id}/feed avec attached_media = [{ media_fbid: ... }, ...].
export async function publishFacebookPagePost(input: {
  pageId: string;
  pageAccessToken: string; // Meta demande explicitement le Page token
  imageUrls: string[];
  caption: string;
}): Promise<
  | { ok: true; postId: string; permalink?: string }
  | { ok: false; error: string }
> {
  if (input.imageUrls.length === 0)
    return { ok: false, error: "Au moins une photo est requise" };

  const message = trimCaption(input.caption);

  // Cas simple : 1 photo → POST /{page-id}/photos
  if (input.imageUrls.length === 1) {
    const body = new URLSearchParams({
      url: input.imageUrls[0],
      caption: message,
      published: "true",
    });
    const r = await graphFetch(`/${input.pageId}/photos`, {
      method: "POST",
      accessToken: input.pageAccessToken,
      body,
    });
    if (!r.ok) return r;
    const post = r.data as { post_id?: string; id?: string };
    const postId = post.post_id || post.id;
    if (!postId) return { ok: false, error: "Réponse Meta sans id" };
    return { ok: true, postId };
  }

  // Cas carrousel : upload chaque photo en unpublished
  const mediaIds: string[] = [];
  for (const url of input.imageUrls) {
    const body = new URLSearchParams({
      url,
      published: "false",
      temporary: "true",
    });
    const r = await graphFetch(`/${input.pageId}/photos`, {
      method: "POST",
      accessToken: input.pageAccessToken,
      body,
    });
    if (!r.ok) return r;
    const id = (r.data as { id?: string }).id;
    if (!id) return { ok: false, error: "Upload photo sans id" };
    mediaIds.push(id);
  }

  // Puis publie le feed avec ces medias attachés
  const attached_media = mediaIds.map((id) => ({ media_fbid: id }));
  const feedBody = new URLSearchParams({
    message,
    attached_media: JSON.stringify(attached_media),
  });
  const feed = await graphFetch(`/${input.pageId}/feed`, {
    method: "POST",
    accessToken: input.pageAccessToken,
    body: feedBody,
  });
  if (!feed.ok) return feed;
  const feedResp = feed.data as { id?: string };
  if (!feedResp.id) return { ok: false, error: "Réponse Meta sans id" };
  return { ok: true, postId: feedResp.id };
}

// ─── Récupérer les métriques d'un post publié ────────────────────
// Trois indicateurs simples : likes, comments, reach. On les stocke
// pour affichage dans BriefCard. Meta délivre les insights à partir
// de quelques heures après publication — appeler trop tôt renverra
// des valeurs à 0.
//
// Le champ `saved` n'est PLUS disponible sur le pack de metrics
// par défaut (depuis Graph 22.0). On garde uniquement les 3 core.
export type IgPostInsights = {
  likes: number;
  comments: number;
  reach: number;
  fetched_at: string; // ISO
};

export async function fetchInstagramInsights(input: {
  postId: string;
  accessToken: string;
}): Promise<
  | { ok: true; insights: IgPostInsights }
  | { ok: false; error: string }
> {
  // Étape 1 : likes + comments via champs classiques
  const basic = await graphFetch(
    `/${input.postId}?fields=like_count,comments_count`,
    { method: "GET", accessToken: input.accessToken }
  );
  if (!basic.ok) return basic;
  const b = basic.data as { like_count?: number; comments_count?: number };

  // Étape 2 : reach via l'endpoint /insights
  const insightsRes = await graphFetch(
    `/${input.postId}/insights?metric=reach`,
    { method: "GET", accessToken: input.accessToken }
  );
  let reach = 0;
  if (insightsRes.ok) {
    const items = (insightsRes.data as { data?: Array<{ name?: string; values?: Array<{ value?: number }> }> }).data;
    const reachItem = items?.find((i) => i.name === "reach");
    reach = reachItem?.values?.[0]?.value ?? 0;
  }
  // On tolère l'échec des insights (post trop récent, pack indispo).

  return {
    ok: true,
    insights: {
      likes: b.like_count ?? 0,
      comments: b.comments_count ?? 0,
      reach,
      fetched_at: new Date().toISOString(),
    },
  };
}

// ─── Vérifier que les creds fonctionnent (utilisé par l'admin) ──────
export async function checkInstagramConnection(input: {
  igUserId: string;
  accessToken: string;
}): Promise<
  | { ok: true; username: string; followers?: number }
  | { ok: false; error: string }
> {
  const r = await graphFetch(
    `/${input.igUserId}?fields=username,followers_count,name`,
    { method: "GET", accessToken: input.accessToken }
  );
  if (!r.ok) return r;
  const d = r.data as { username?: string; followers_count?: number };
  if (!d.username) return { ok: false, error: "Réponse sans username" };
  return { ok: true, username: d.username, followers: d.followers_count };
}
