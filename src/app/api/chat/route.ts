import { NextRequest, NextResponse } from "next/server";
import {
  effectivePrompt,
  getAgent,
  listKnowledge,
  logEvent,
} from "@/lib/agents";
import {
  addMessage,
  getOrCreateConversation,
  incrementMessageCount,
  listMessages,
  markConversationNotified,
  renderLeadEmailHtml,
  updateLeadData,
  type LeadData,
} from "@/lib/site-chat";
import { sendLeadNotification } from "@/lib/mailer";
import { withTransaction } from "@/lib/db";

/*
 * POST /api/chat
 * ─────────────────────────────────────────────────────────────────────
 * Endpoint conversationnel du site public.
 *
 * Input JSON :
 *   { session_id: string, message: string, user_agent?: string, referrer?: string }
 *
 * Réponse JSON :
 *   { ok: true, reply: string, tools_used: string[], conversation_id: number }
 *   ou { ok: false, error: string }
 *
 * Flow :
 *   1. Charge l'agent 'site' (prompt + KB + config).
 *   2. Charge ou crée la conversation par session_id.
 *   3. Reconstitue tout l'historique des messages.
 *   4. Appelle Claude avec les outils record_lead_info + send_lead_notification.
 *   5. Boucle tool-use jusqu'à réponse texte finale (max 4 tours).
 *   6. Persiste tout, log l'event, retourne la réponse.
 *
 * Sécurité :
 *   - Rate-limit basique via count par session (max 60 messages).
 *   - session_id contrôlé côté format (32-128 chars alphanumériques).
 *   - Pas de clé API exposée : la clé Anthropic vit dans agent_installations.config.
 *
 * Le runtime est explicite Node (pas Edge) parce qu'on utilise pg + Resend.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGES_PER_SESSION = 60;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOOL_TURNS = 4;
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

// ─── Types Claude API (subset — juste ce dont on a besoin) ─────────────
type ClaudeToolUse = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
type ClaudeText = { type: "text"; text: string };
type ClaudeContentBlock = ClaudeText | ClaudeToolUse;
type ClaudeResponse = {
  id: string;
  content: ClaudeContentBlock[];
  stop_reason: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};
type ClaudeMessage =
  | { role: "user"; content: string | Array<Record<string, unknown>> }
  | { role: "assistant"; content: ClaudeContentBlock[] | string };

// ─── Définition des outils exposés à Claude ────────────────────────────
const TOOLS = [
  {
    name: "record_lead_info",
    description:
      "Enregistre progressivement les informations d'un prospect au fur et à mesure qu'elles apparaissent dans la conversation. À appeler dès qu'une nouvelle info est mentionnée par le visiteur. Silencieux — ne pas l'annoncer au visiteur.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_name: { type: "string", description: "Prénom et/ou nom du visiteur" },
        contact_email: { type: "string", description: "E-mail du visiteur" },
        contact_phone: { type: "string", description: "Téléphone (format FR de préférence)" },
        wedding_date: {
          type: "string",
          description: "Date du mariage. Format ISO YYYY-MM-DD si précis, sinon description libre (« été 2027 »).",
        },
        wedding_location: {
          type: "string",
          description: "Ville, région ou lieu de réception du mariage",
        },
        guest_count: {
          type: "integer",
          description: "Nombre d'invités attendus",
        },
        preferred_formula: {
          type: "string",
          description:
            "Formule pressentie : Essentielle / Grand Jour / Grand Classique / Prestige Éternel",
        },
        style_notes: {
          type: "string",
          description: "Notes sur le style, l'ambiance, les moments clés pour le couple",
        },
        budget_range: {
          type: "string",
          description: "Fourchette de budget mentionnée par le visiteur",
        },
        how_found: {
          type: "string",
          description: "Comment le visiteur a découvert Mickael (Instagram, Google, bouche-à-oreille…)",
        },
      },
    },
  },
  {
    name: "send_lead_notification",
    description:
      "Envoie un e-mail récapitulatif à Mickael avec les infos du prospect + résumé de l'échange. À utiliser UNE SEULE FOIS en fin de conversation qualifiée. Requiert au minimum contact_name + contact_email + (wedding_date OU wedding_location).",
    input_schema: {
      type: "object" as const,
      required: ["summary"],
      properties: {
        summary: {
          type: "string",
          description:
            "Résumé de la conversation en 3-6 phrases, briefing à voix haute pour Mickael. Mentionne ton, budget si évoqué, points d'attention.",
        },
      },
    },
  },
];

// ─── Handlers ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object")
      return json({ ok: false, error: "Corps de requête invalide" }, 400);

    const sessionId = typeof body.session_id === "string" ? body.session_id : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const userAgent = typeof body.user_agent === "string" ? body.user_agent.slice(0, 500) : null;
    const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null;

    if (!/^[a-z0-9-]{16,128}$/i.test(sessionId))
      return json({ ok: false, error: "session_id invalide" }, 400);
    if (!message) return json({ ok: false, error: "Message vide" }, 400);
    if (message.length > MAX_MESSAGE_LENGTH)
      return json({ ok: false, error: `Message trop long (max ${MAX_MESSAGE_LENGTH} car.)` }, 400);

    // Agent
    const inst = await getAgent("site");
    if (!inst) return json({ ok: false, error: "Agent site indisponible" }, 503);
    const apiKey = (inst.config as { anthropic_api_key?: string })?.anthropic_api_key;
    if (!apiKey)
      return json(
        {
          ok: false,
          error:
            "Le chatbot n'est pas encore activé. Merci de laisser un message via le formulaire /contact.",
        },
        503
      );

    // Conversation
    const conv = await getOrCreateConversation(sessionId, { user_agent: userAgent, referrer });
    if (conv.message_count >= MAX_MESSAGES_PER_SESSION)
      return json({ ok: false, error: "Limite de messages atteinte pour cette session" }, 429);

    // Historique
    const history = await listMessages(conv.id);

    // Persiste le message utilisateur
    await addMessage({ conversation_id: conv.id, role: "user", content: message });

    // Construit les messages pour Claude
    const claudeMessages: ClaudeMessage[] = [];
    for (const m of history) {
      if (m.role === "user") {
        claudeMessages.push({ role: "user", content: m.content });
      } else if (m.role === "assistant") {
        // Si tool_calls, on reconstruit les blocs. Sinon simple string.
        if (m.tool_calls && Array.isArray(m.tool_calls)) {
          claudeMessages.push({
            role: "assistant",
            content: m.tool_calls as ClaudeContentBlock[],
          });
        } else {
          claudeMessages.push({ role: "assistant", content: m.content });
        }
      } else if (m.role === "tool") {
        // Les tool_results sont attachés au message user suivant (spec Anthropic).
        // On les réinjecte comme un content block user.
        try {
          const parsed = JSON.parse(m.content) as {
            tool_use_id: string;
            content: string;
          };
          claudeMessages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: parsed.tool_use_id,
                content: parsed.content,
              },
            ],
          });
        } catch {
          /* on ignore un tool_result corrompu, on ne plante pas la conversation */
        }
      }
    }
    // Ajoute le message utilisateur courant en dernier
    claudeMessages.push({ role: "user", content: message });

    // System prompt = prompt effectif + KB
    const kb = await listKnowledge("site");
    const kbBlock = kb.length
      ? "\n\n# BASE DE CONNAISSANCES (contenu fourni par le photographe)\n" +
        kb.map((k) => `## ${k.title} [${k.category}]\n${k.content}`).join("\n\n")
      : "";
    const systemPrompt = effectivePrompt(inst) + kbBlock;

    // Boucle Claude + tool-use
    // ────────────────────────────────────────────────────────────────
    // 3 propriétés à préserver :
    //   (a) tout texte émis par Claude à un tour intermédiaire (souvent
    //       « Un instant, je note ça… ») doit finir dans finalText.
    //   (b) chaque assistant-avec-tool_use doit être persisté DANS LA
    //       MÊME TRANSACTION que ses tool_result correspondants, sinon
    //       une écriture partielle rend la conversation inutilisable
    //       (Anthropic 400 : tool_use ids ... were not found).
    //   (c) une erreur de tool (ex : DB down sur updateLeadData) ne doit
    //       pas leak son message brut au visiteur, même à travers Claude.
    const toolsUsed: string[] = [];
    const collectedText: string[] = [];
    let lastAssistantBlocks: ClaudeContentBlock[] = [];

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const t0 = Date.now();
      const resp = await callClaude({
        apiKey,
        system: systemPrompt,
        messages: claudeMessages,
      });
      const duration = Date.now() - t0;

      lastAssistantBlocks = resp.content;

      const toolUses = resp.content.filter(
        (b): b is ClaudeToolUse => b.type === "tool_use"
      );
      const textBlocks = resp.content.filter(
        (b): b is ClaudeText => b.type === "text"
      );
      const turnText = textBlocks.map((b) => b.text).join("\n").trim();
      if (turnText) collectedText.push(turnText);

      if (toolUses.length === 0) {
        // Tour terminal : plus de tool_use → on persiste juste l'assistant.
        await addMessage({
          conversation_id: conv.id,
          role: "assistant",
          content: turnText || "(vide)",
          duration_ms: duration,
        });
        break;
      }

      // Tour intermédiaire : exécute chaque tool en amont, puis persiste
      // atomiquement (assistant + tous les tool_result) dans UNE
      // transaction. Si l'insert échoue à mi-chemin, rien n'est écrit.
      const toolExecutions: Array<{
        tu: ClaudeToolUse;
        publicResult: string; // ce qu'on montre à Claude
        eventName: string | null; // event stats à logger après commit
        eventPayload: Record<string, unknown>;
        eventSuccess: boolean;
      }> = [];

      for (const tu of toolUses) {
        toolsUsed.push(tu.name);
        let publicResult = "";
        let eventName: string | null = null;
        let eventPayload: Record<string, unknown> = {};
        let eventSuccess = true;
        try {
          if (tu.name === "record_lead_info") {
            await updateLeadData(conv.id, tu.input as LeadData);
            publicResult = "OK · info enregistrée";
            eventName = "lead_info_recorded";
            eventPayload = { fields: Object.keys(tu.input) };
          } else if (tu.name === "send_lead_notification") {
            const summary =
              typeof tu.input.summary === "string" ? tu.input.summary : "";
            const sendResult = await handleSendLead(conv.id, summary);
            publicResult = sendResult.sent
              ? "OK · e-mail envoyé à Mickael"
              : "Échec de l'envoi — merci de réessayer";
            eventName = "lead_email_sent";
            eventPayload = { sent: sendResult.sent };
            eventSuccess = sendResult.sent;
          } else {
            publicResult = "ERREUR · outil inconnu";
            eventSuccess = false;
          }
        } catch (e) {
          // Message contenant potentiellement du SQL brut → on log en
          // interne mais on ne le repasse pas à Claude / au visiteur.
          console.error(`[chat/tool ${tu.name}]`, e);
          publicResult = "ERREUR · échec technique, la conversation continue";
          eventName = `${tu.name}_error`;
          eventPayload = { error: e instanceof Error ? e.message : String(e) };
          eventSuccess = false;
        }
        toolExecutions.push({
          tu,
          publicResult,
          eventName,
          eventPayload,
          eventSuccess,
        });
      }

      // Persistance atomique : assistant + tous les tool_result. Si un
      // insert plante, ROLLBACK et la conversation reste dans un état
      // cohérent (pas d'assistant orphelin avec tool_use pending).
      await withTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO chat_messages (conversation_id, role, content, tool_calls, duration_ms)
           VALUES ($1, 'assistant', $2, $3::jsonb, $4)`,
          [
            conv.id,
            turnText,
            JSON.stringify(resp.content),
            duration,
          ]
        );
        for (const ex of toolExecutions) {
          await tx.execute(
            `INSERT INTO chat_messages (conversation_id, role, content)
             VALUES ($1, 'tool', $2)`,
            [
              conv.id,
              JSON.stringify({
                tool_use_id: ex.tu.id,
                content: ex.publicResult,
              }),
            ]
          );
        }
      });

      // Events stats — hors transaction, best-effort.
      for (const ex of toolExecutions) {
        if (ex.eventName) {
          try {
            await logEvent("site", ex.eventName, ex.eventPayload, ex.eventSuccess);
          } catch {
            /* stats hors chemin critique */
          }
        }
      }

      // Alimente les messages pour le prochain tour Claude.
      claudeMessages.push({ role: "assistant", content: resp.content });
      claudeMessages.push({
        role: "user",
        content: toolExecutions.map((ex) => ({
          type: "tool_result",
          tool_use_id: ex.tu.id,
          content: ex.publicResult,
        })),
      });
    }

    // Compose la réponse finale : concaténation de tout texte émis
    // (pas seulement le dernier tour). Failsafe si Claude a bouclé
    // sans jamais produire de texte.
    let finalText = collectedText.join("\n\n").trim();
    if (!finalText) {
      const fallback = lastAssistantBlocks
        .filter((b): b is ClaudeText => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      finalText =
        fallback ||
        "Je vous prie de m'excuser, je n'ai pas pu formuler de réponse — pourriez-vous reformuler votre question ?";
    }

    await incrementMessageCount(conv.id, 2); // user + assistant

    await logEvent("site", "chat_turn", {
      conversation_id: conv.id,
      tools_used: toolsUsed,
      reply_chars: finalText.length,
    });

    return json({
      ok: true,
      reply: finalText,
      tools_used: toolsUsed,
      conversation_id: conv.id,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[api/chat] error:", err);
    try {
      await logEvent("site", "chat_error", { error: err }, false);
    } catch {}
    return json(
      {
        ok: false,
        error:
          "Une erreur est survenue. Merci de réessayer, ou de nous joindre via la page /contact si cela persiste.",
      },
      500
    );
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────
async function callClaude(input: {
  apiKey: string;
  system: string;
  messages: ClaudeMessage[];
}): Promise<ClaudeResponse> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: input.system,
      tools: TOOLS,
      messages: input.messages,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Anthropic HTTP ${resp.status} · ${txt.slice(0, 400)}`);
  }
  return (await resp.json()) as ClaudeResponse;
}

async function handleSendLead(
  conversationId: number,
  summary: string
): Promise<{ sent: boolean; error?: string }> {
  const { getConversationById, listMessages: getMsgs } = await import("@/lib/site-chat");
  const conv = await getConversationById(conversationId);
  if (!conv) return { sent: false, error: "conversation introuvable" };
  const msgs = await getMsgs(conversationId);
  const transcript = msgs
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://romerophotography.fr";
  const html = renderLeadEmailHtml({
    lead: conv.lead_data,
    summary,
    conversation: transcript,
    siteUrl,
    conversationId,
  });
  const text =
    `Nouveau lead — ${conv.lead_data.contact_name ?? "(sans nom)"}\n\n` +
    `Résumé : ${summary}\n\n` +
    `Coordonnées :\n` +
    `  Nom     : ${conv.lead_data.contact_name ?? "—"}\n` +
    `  E-mail  : ${conv.lead_data.contact_email ?? "—"}\n` +
    `  Tél     : ${conv.lead_data.contact_phone ?? "—"}\n` +
    `  Date    : ${conv.lead_data.wedding_date ?? "—"}\n` +
    `  Lieu    : ${conv.lead_data.wedding_location ?? "—"}\n\n` +
    `Ouvrir la conversation : ${siteUrl}/admin/agents/site?tab=conversations&conv=${conversationId}`;

  const subjectName = conv.lead_data.contact_name ?? "prospect";
  const subject = `Nouveau lead qualifié — ${subjectName}`;
  const res = await sendLeadNotification({
    subject,
    html,
    text,
    replyToEmail: conv.lead_data.contact_email,
    replyToName: conv.lead_data.contact_name,
  });
  if (res.sent) {
    await markConversationNotified(conversationId);
    // ── Bridge Site → Admin CRM ──
    // Le lead capturé par le chatbot devient un contact CRM dans
    // admin_contacts. Upsert par email : si le contact existe déjà,
    // on met à jour ses infos (nouvelles date, lieu, notes) sans
    // écraser ce qui a été renseigné manuellement.
    upsertLeadToContactCrm(conv.lead_data).catch((err) => {
      console.error("[chat/lead → crm]", err);
    });
  }
  return { sent: res.sent, error: res.error };
}

async function upsertLeadToContactCrm(lead: import("@/lib/site-chat").LeadData) {
  const name = lead.contact_name?.trim();
  const email = lead.contact_email?.trim();
  if (!name && !email) return; // rien d'utile à insérer
  const { query, queryOne, execute } = await import("@/lib/db");
  // Recherche par email en priorité (le nom peut varier), fallback par nom.
  let existing: { id: number } | null = null;
  if (email) {
    existing = await queryOne<{ id: number }>(
      `SELECT id FROM admin_contacts WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
  }
  if (!existing && name) {
    existing = await queryOne<{ id: number }>(
      `SELECT id FROM admin_contacts WHERE LOWER(name) = LOWER($1)`,
      [name]
    );
  }

  const noteAppend = `Prospect issu du chatbot site le ${new Date().toLocaleDateString("fr-FR")}.`;

  if (existing) {
    // Update prudent : ne remplace jamais un champ existant, on
    // n'ajoute que si vide (COALESCE côté SQL). Note additionnée.
    await execute(
      `UPDATE admin_contacts SET
         email          = COALESCE(email, $1),
         phone          = COALESCE(phone, $2),
         address        = COALESCE(address, $3),
         wedding_date   = COALESCE(wedding_date, NULLIF($4, '')::date),
         wedding_location = COALESCE(wedding_location, $5),
         notes          = CASE
                            WHEN notes IS NULL OR notes = '' THEN $6
                            WHEN notes LIKE '%' || $6 || '%' THEN notes
                            ELSE notes || E'\n' || $6
                          END,
         updated_at     = NOW()
       WHERE id = $7`,
      [
        email ?? null,
        lead.contact_phone ?? null,
        null,
        looksLikeIsoDate(lead.wedding_date) ? lead.wedding_date : "",
        lead.wedding_location ?? null,
        noteAppend,
        existing.id,
      ]
    );
  } else {
    await execute(
      `INSERT INTO admin_contacts
         (name, email, phone, wedding_date, wedding_location, notes)
       VALUES ($1, $2, $3, NULLIF($4, '')::date, $5, $6)`,
      [
        name ?? "(sans nom)",
        email ?? null,
        lead.contact_phone ?? null,
        looksLikeIsoDate(lead.wedding_date) ? lead.wedding_date : "",
        lead.wedding_location ?? null,
        noteAppend,
      ]
    );
  }
  // On log l'événement côté agent site — traçabilité de l'origine.
  await query(
    `INSERT INTO agent_events (agent_slug, event_type, payload, success)
     VALUES ('site', 'lead_promoted_to_contact', $1::jsonb, TRUE)`,
    [JSON.stringify({ email, name })]
  );
}

function looksLikeIsoDate(s: string | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}
