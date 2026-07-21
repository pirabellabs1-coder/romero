/**
 * /api/instagram/webhook
 * ────────────────────────
 * Endpoint pour recevoir les DMs Instagram + comments + mentions via
 * Meta Graph API webhook. Structure des payloads similaire à Messenger.
 *
 * Config côté Meta app dashboard (produit Instagram) :
 *   - Callback URL : https://romerophotography.fr/api/instagram/webhook
 *   - Verify Token : WHATSAPP_VERIFY_TOKEN (on réutilise le même)
 *   - Champs abonnés : messages, comments (facultatif)
 *
 * Sécurité :
 *   - Vérification hub.verify_token en GET
 *   - Idéalement X-Hub-Signature-256 en POST (TODO Phase 2)
 *
 * Stockage :
 *   - assistant_sessions[platform='instagram'] par IG scoped user_id
 *   - assistant_messages : chaque message user + réponse assistant
 *
 * Affichage : automatique dans /admin/inbox (channel = instagram).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSharedConfig } from "@/lib/studio-settings";
import { execute, queryOne } from "@/lib/db";
import { logEvent } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET : vérification challenge Meta ────────────────────────────────
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json(
    { ok: false, error: "invalid_verify_token" },
    { status: 403 }
  );
}

// ─── Types Meta Instagram webhook (subset) ────────────────────────────
type IgWebhook = {
  object?: string;
  entry?: Array<{
    id: string;
    time: number;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        attachments?: Array<{
          type: string;
          payload?: { url?: string };
        }>;
      };
    }>;
    changes?: Array<{
      field: string;
      value: Record<string, unknown>;
    }>;
  }>;
};

// ─── Meta Graph helpers ───────────────────────────────────────────────
async function fetchIgProfile(
  igScopedUserId: string,
  accessToken: string
): Promise<{ name?: string; username?: string } | null> {
  try {
    const url = new URL(
      `https://graph.facebook.com/v20.0/${igScopedUserId}`
    );
    url.searchParams.set("fields", "name,username");
    url.searchParams.set("access_token", accessToken);
    const r = await fetch(url.toString());
    if (!r.ok) return null;
    return (await r.json()) as { name?: string; username?: string };
  } catch {
    return null;
  }
}

async function findOrCreateSession(
  userId: string,
  displayName: string | null
): Promise<number> {
  const existing = await queryOne<{ id: number; display_name: string | null }>(
    `SELECT id, display_name FROM assistant_sessions
     WHERE platform = 'instagram' AND platform_user_id = $1`,
    [userId]
  );
  if (existing) {
    // Update display_name si on en a un meilleur maintenant
    if (displayName && !existing.display_name) {
      await execute(
        `UPDATE assistant_sessions SET display_name = $1, updated_at = NOW()
         WHERE id = $2`,
        [displayName, existing.id]
      ).catch(() => {});
    } else {
      await execute(
        `UPDATE assistant_sessions SET updated_at = NOW() WHERE id = $1`,
        [existing.id]
      ).catch(() => {});
    }
    return existing.id;
  }
  const row = await queryOne<{ id: number }>(
    `INSERT INTO assistant_sessions (platform, platform_user_id, display_name)
     VALUES ('instagram', $1, $2)
     RETURNING id`,
    [userId, displayName]
  );
  return row!.id;
}

async function saveIncomingMessage(
  sessionId: number,
  content: string
): Promise<void> {
  await execute(
    `INSERT INTO assistant_messages (session_id, role, content)
     VALUES ($1, 'user', $2)`,
    [sessionId, content]
  );
  await execute(
    `UPDATE assistant_sessions
     SET message_count = message_count + 1, updated_at = NOW()
     WHERE id = $1`,
    [sessionId]
  );
}

// ─── POST : réception événement ──────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const update = (await req.json().catch(() => null)) as IgWebhook | null;
    if (!update || update.object !== "instagram") {
      return NextResponse.json({ ok: true, ignored: "not_instagram" });
    }

    const shared = await getSharedConfig().catch(
      () => ({} as Record<string, string>)
    );
    const accessToken = shared.meta_access_token;

    for (const entry of update.entry ?? []) {
      // Cas 1 : DM entrant (champ « messages »)
      for (const msg of entry.messaging ?? []) {
        // Le sender est le user IG qui écrit, le recipient est le business account
        const senderId = msg.sender?.id;
        if (!senderId) continue;

        // Skip nos propres messages sortants (echo)
        if (senderId === entry.id) continue;

        let text = msg.message?.text ?? "";
        if (!text && msg.message?.attachments && msg.message.attachments.length > 0) {
          const kinds = msg.message.attachments.map((a) => a.type).join(", ");
          text = `[Pièce(s) jointe(s) : ${kinds}]`;
        }
        if (!text) continue;

        // Récup profil IG pour un affichage propre dans l'inbox
        let displayName: string | null = null;
        if (accessToken) {
          const profile = await fetchIgProfile(senderId, accessToken);
          if (profile) {
            displayName = profile.name
              ? profile.username
                ? `${profile.name} (@${profile.username})`
                : profile.name
              : profile.username
              ? `@${profile.username}`
              : null;
          }
        }

        const sessionId = await findOrCreateSession(senderId, displayName);
        await saveIncomingMessage(sessionId, text);
        await logEvent(
          "marketing",
          "instagram_dm_received",
          { sender_id: senderId, session_id: sessionId, text_len: text.length },
          true
        );
      }

      // Cas 2 : commentaires / mentions (champ « comments »)
      for (const change of entry.changes ?? []) {
        if (change.field === "comments") {
          await logEvent(
            "marketing",
            "instagram_comment_received",
            change.value,
            true
          );
        } else if (change.field === "mentions") {
          await logEvent(
            "marketing",
            "instagram_mention_received",
            change.value,
            true
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[instagram/webhook] POST error:", e);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
