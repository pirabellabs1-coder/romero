/**
 * POST /api/admin/inbox/reply
 * ────────────────────────────
 * Envoyer une réponse depuis l'Inbox admin vers le canal du thread.
 * Supporte : WhatsApp Cloud, Telegram, Instagram DM.
 *
 * Body: { threadId: "assistant_42", text: "Merci pour votre message !" }
 *
 * Détecte le canal via assistant_sessions.platform, dispatche vers
 * l'API du fournisseur, puis stocke le message sortant dans
 * assistant_messages pour qu'il apparaisse dans le thread.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { execute, queryOne } from "@/lib/db";
import { getSharedConfig } from "@/lib/studio-settings";
import { logEvent } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sendWhatsApp(
  params: { phoneId: string; token: string; to: string; text: string }
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  try {
    const r = await fetch(
      `https://graph.facebook.com/v20.0/${params.phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: params.to,
          type: "text",
          text: { body: params.text },
        }),
      }
    );
    const json = (await r.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };
    if (!r.ok || !json.messages?.[0])
      return { ok: false, error: json.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, id: json.messages[0].id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "?" };
  }
}

async function sendTelegram(params: {
  token: string;
  chatId: string;
  text: string;
}): Promise<{ ok: true; id?: number } | { ok: false; error: string }> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${params.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: params.chatId, text: params.text }),
    });
    const json = (await r.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { message_id: number };
      description?: string;
    };
    if (!json.ok || !json.result)
      return { ok: false, error: json.description ?? `HTTP ${r.status}` };
    return { ok: true, id: json.result.message_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "?" };
  }
}

async function sendInstagram(params: {
  pageId: string;
  token: string;
  igScopedUserId: string;
  text: string;
}): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  try {
    const r = await fetch(
      `https://graph.facebook.com/v20.0/${params.pageId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: { id: params.igScopedUserId },
          message: { text: params.text },
          messaging_type: "RESPONSE",
        }),
      }
    );
    const json = (await r.json().catch(() => ({}))) as {
      message_id?: string;
      error?: { message?: string };
    };
    if (!r.ok || !json.message_id)
      return { ok: false, error: json.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, id: json.message_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "?" };
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { threadId?: string; text?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const threadId = (body.threadId ?? "").trim();
  const text = (body.text ?? "").trim();
  if (!threadId.startsWith("assistant_"))
    return NextResponse.json(
      { ok: false, error: "Ce type de thread ne supporte pas la réponse directe." },
      { status: 400 }
    );
  if (!text)
    return NextResponse.json({ ok: false, error: "Texte vide." }, { status: 400 });
  if (text.length > 4000)
    return NextResponse.json(
      { ok: false, error: "Message trop long (4000 max)." },
      { status: 400 }
    );

  const sessionId = parseInt(threadId.replace("assistant_", ""), 10);
  if (!Number.isFinite(sessionId))
    return NextResponse.json({ ok: false, error: "ID invalide" }, { status: 400 });

  const sess = await queryOne<{
    platform: string;
    platform_user_id: string;
  }>(
    `SELECT platform, platform_user_id FROM assistant_sessions WHERE id = $1`,
    [sessionId]
  );
  if (!sess) return NextResponse.json({ ok: false, error: "Session introuvable" }, { status: 404 });

  const shared = await getSharedConfig().catch(() => ({} as Record<string, string>));

  let sendResult: { ok: true; id?: string | number } | { ok: false; error: string };
  if (sess.platform === "whatsapp") {
    const token = shared.whatsapp_access_token;
    const phoneId = shared.whatsapp_phone_number_id;
    if (!token || !phoneId)
      return NextResponse.json(
        { ok: false, error: "WhatsApp non configuré." },
        { status: 400 }
      );
    sendResult = await sendWhatsApp({
      phoneId,
      token,
      to: sess.platform_user_id,
      text,
    });
  } else if (sess.platform === "telegram") {
    const token = shared.telegram_bot_token;
    if (!token)
      return NextResponse.json(
        { ok: false, error: "Telegram non configuré." },
        { status: 400 }
      );
    sendResult = await sendTelegram({
      token,
      chatId: sess.platform_user_id,
      text,
    });
  } else if (sess.platform === "instagram") {
    const token = shared.meta_access_token;
    const pageId = shared.meta_page_id;
    if (!token || !pageId)
      return NextResponse.json(
        { ok: false, error: "Instagram/Page non configuré." },
        { status: 400 }
      );
    sendResult = await sendInstagram({
      pageId,
      token,
      igScopedUserId: sess.platform_user_id,
      text,
    });
  } else {
    return NextResponse.json({ ok: false, error: "Canal inconnu" }, { status: 400 });
  }

  if (!sendResult.ok) {
    await logEvent(
      sess.platform === "whatsapp" ? "whatsapp" : "marketing",
      "inbox_reply_error",
      { platform: sess.platform, session_id: sessionId, error: sendResult.error },
      false
    );
    return NextResponse.json({ ok: false, error: sendResult.error }, { status: 502 });
  }

  // Stocke le message sortant pour qu'il apparaisse dans le thread
  await execute(
    `INSERT INTO assistant_messages (session_id, role, content)
     VALUES ($1, 'assistant', $2)`,
    [sessionId, text]
  ).catch(() => {});
  await execute(
    `UPDATE assistant_sessions SET message_count = message_count + 1, updated_at = NOW()
     WHERE id = $1`,
    [sessionId]
  ).catch(() => {});
  await logEvent(
    sess.platform === "whatsapp" ? "whatsapp" : "marketing",
    "inbox_reply_sent",
    { platform: sess.platform, session_id: sessionId, provider_id: sendResult.id },
    true
  );

  return NextResponse.json({ ok: true, providerId: sendResult.id });
}
