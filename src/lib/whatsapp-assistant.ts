// ──────────────────────────────────────────────────────────────────────
// Boucle assistant WhatsApp/Telegram — Claude + outils Google Calendar
// ──────────────────────────────────────────────────────────────────────
//
// Point d'entrée unique appelé par les 2 webhooks (Telegram + WhatsApp).
// Reçoit un message texte + un identifiant de session (platform + user id),
// appelle Claude Haiku 4.5 avec 5 outils calendar, exécute les outils,
// boucle jusqu'à réponse finale, persiste tout.
//
// Principes :
//   1. Une session par (platform, platform_user_id) → l'historique est
//      conservé et injecté dans chaque appel Claude.
//   2. Les outils modifient réellement Google Calendar via la lib
//      google-calendar. Aucun mock, aucun dry-run.
//   3. Transaction pour chaque tour (assistant + tool_result groupés).
//   4. Si les creds Google manquent → l'outil renvoie une erreur claire
//      que Claude verbalise sans planter.
//   5. Limite 4 tours de tool_use — au-delà, on tronque et on prévient.
//
// Sécurité :
//   Le prompt système précise que le seul interlocuteur légitime est
//   Mickael. En prod, on ajoutera un filtrage par platform_user_id
//   (whitelist configurable depuis /admin/agents/whatsapp).

import { withTransaction, query, queryOne, execute } from "@/lib/db";
import { getClaudeEndpoint, cachedSystem } from "@/lib/claude-endpoint";
import { parisYMD, parisOffset, parisHuman, addDaysYMD, parisTimeContext } from "@/lib/paris-time";
import {
  buildClient,
  createEvent,
  createEventWithMeet,
  deleteEvent,
  findFreeSlots,
  isBlockingEvent,
  isFreeSlot,
  listEvents,
  updateEvent,
  type AuthedClient,
} from "@/lib/google-calendar";
import {
  effectivePrompt,
  getAgent,
  listKnowledge,
  logEvent,
} from "@/lib/agents";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOOL_TURNS = 4;
const MAX_HISTORY_MESSAGES = 24; // fenêtre glissante — 24 suffit pour le fil d'un échange agenda, économise des tokens

// ─── Types Claude (subset) ─────────────────────────────────────────────
type ClaudeToolUse = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
type ClaudeText = { type: "text"; text: string };
type ClaudeToolResult = { type: "tool_result"; tool_use_id: string; content: string };
type ClaudeContentBlock = ClaudeText | ClaudeToolUse;
type ClaudeMessage =
  | { role: "user"; content: string | Array<Record<string, unknown>> }
  | { role: "assistant"; content: ClaudeContentBlock[] | string };
type ClaudeResponse = {
  content: ClaudeContentBlock[];
  stop_reason: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

// ─── Types métier ──────────────────────────────────────────────────────
export type Platform = "telegram" | "whatsapp";

export type AssistantSession = {
  id: number;
  platform: Platform;
  platform_user_id: string;
  display_name: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
};

export type AssistantMessage = {
  id: number;
  session_id: number;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls: unknown | null;
  duration_ms: number | null;
  created_at: string;
};

// ─── Persistance sessions ──────────────────────────────────────────────
export async function getOrCreateSession(input: {
  platform: Platform;
  platformUserId: string;
  displayName?: string | null;
}): Promise<AssistantSession> {
  const found = await query<AssistantSession>(
    `SELECT * FROM assistant_sessions WHERE platform = $1 AND platform_user_id = $2`,
    [input.platform, input.platformUserId]
  );
  if (found.length > 0) return found[0];
  const created = await query<AssistantSession>(
    `INSERT INTO assistant_sessions (platform, platform_user_id, display_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.platform, input.platformUserId, input.displayName ?? null]
  );
  return created[0];
}

async function listSessionMessages(
  sessionId: number,
  limit = MAX_HISTORY_MESSAGES
): Promise<AssistantMessage[]> {
  // On veut les N plus récents mais dans l'ordre chronologique croissant
  // pour Claude. Sous-requête : SELECT ... ORDER BY id DESC LIMIT + inverse.
  return query<AssistantMessage>(
    `WITH tail AS (
       SELECT * FROM assistant_messages
       WHERE session_id = $1
       ORDER BY id DESC
       LIMIT $2
     )
     SELECT * FROM tail ORDER BY id ASC`,
    [sessionId, limit]
  );
}

// ─── Définition des outils Claude ──────────────────────────────────────
// Chaque outil est décrit avec un input_schema strict. Claude utilise ces
// descriptions pour décider quand appeler chaque outil.
const TOOLS = [
  {
    name: "get_current_datetime",
    description:
      "Renvoie la date et heure actuelles au format ISO 8601 dans le fuseau horaire de Mickael. À appeler AVANT toute autre opération temporelle pour connaître le contexte (aujourd'hui, demain, cette semaine).",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_calendar_events",
    description:
      "Liste les événements de l'agenda entre deux datetimes ISO. À utiliser pour répondre à « qu'est-ce que j'ai demain / cette semaine / le 15 juin ». Les datetimes doivent être en ISO 8601 avec fuseau (ex : 2027-06-15T00:00:00+02:00).",
    input_schema: {
      type: "object" as const,
      required: ["time_min", "time_max"],
      properties: {
        time_min: { type: "string", description: "Début de la fenêtre (ISO 8601 avec fuseau)" },
        time_max: { type: "string", description: "Fin de la fenêtre (ISO 8601 avec fuseau)" },
        query: { type: "string", description: "Recherche textuelle optionnelle dans les titres" },
      },
    },
  },
  {
    name: "check_availability",
    description:
      "Vérifie si un créneau précis est libre (aucun événement le chevauche). Renvoie true/false. À utiliser AVANT de créer un événement quand la disponibilité est incertaine.",
    input_schema: {
      type: "object" as const,
      required: ["start", "end"],
      properties: {
        start: { type: "string", description: "Début du créneau (ISO 8601 avec fuseau)" },
        end: { type: "string", description: "Fin du créneau (ISO 8601 avec fuseau)" },
      },
    },
  },
  {
    name: "create_event",
    description:
      "Crée un nouvel événement dans l'agenda. Par défaut, le tool REFUSE si un événement existe déjà sur le créneau et te renvoie les détails du conflit — c'est à toi (l'assistant) de dire à Mickael « il y a déjà X à cette heure, veux-tu quand même ? ». Ne mets `force: true` QUE si Mickael a explicitement confirmé qu'il veut créer malgré le conflit. Après création, confirmer en une ligne avec l'heure et le titre.",
    input_schema: {
      type: "object" as const,
      required: ["title", "start", "end"],
      properties: {
        title: { type: "string", description: "Titre de l'événement" },
        start: { type: "string", description: "Début (ISO 8601 avec fuseau)" },
        end: { type: "string", description: "Fin (ISO 8601 avec fuseau)" },
        description: { type: "string", description: "Notes libres" },
        location: { type: "string", description: "Lieu (adresse, salle, visioconférence)" },
        attendee_emails: {
          type: "array",
          items: { type: "string" },
          description: "E-mails des participants — invitation NON envoyée automatiquement",
        },
        force: {
          type: "boolean",
          description:
            "Créer même si un événement existe déjà sur ce créneau. FALSE par défaut. Ne mettre à TRUE que si Mickael a explicitement confirmé qu'il veut créer malgré le conflit.",
        },
      },
    },
  },
  {
    name: "update_event",
    description:
      "Modifie un événement existant. Nécessite l'event_id, obtenu via list_calendar_events. Les champs non-fournis restent inchangés.",
    input_schema: {
      type: "object" as const,
      required: ["event_id"],
      properties: {
        event_id: { type: "string", description: "ID Google Calendar de l'événement" },
        title: { type: "string" },
        start: { type: "string" },
        end: { type: "string" },
        description: { type: "string" },
        location: { type: "string" },
      },
    },
  },
  {
    name: "delete_event",
    description:
      "Supprime définitivement un événement. IRRÉVERSIBLE. Tu DOIS d'abord montrer l'événement à Mickael (titre + date/heure) et attendre un OUI EXPLICITE (« oui, supprime », « valide », « confirme »). Un simple « annule mardi » n'est PAS une confirmation — c'est une intention à clarifier via list_calendar_events d'abord. Passe `user_confirmed=true` uniquement quand la confirmation est reçue.",
    input_schema: {
      type: "object" as const,
      required: ["event_id", "user_confirmed"],
      properties: {
        event_id: { type: "string", description: "ID de l'événement à supprimer (obtenu via list_calendar_events)" },
        user_confirmed: {
          type: "boolean",
          description: "DOIT être true — sinon le tool refuse. Prouve que Mickael a explicitement confirmé la suppression dans son dernier message.",
        },
      },
    },
  },
  {
    name: "create_event_with_meet",
    description:
      "Crée un événement Google Calendar AVEC un lien Google Meet automatiquement généré. Par défaut, REFUSE si un événement existe déjà sur le créneau — dis à Mickael « il y a déjà X, tu veux quand même ? ». Ne mets `force: true` QU'après confirmation explicite de Mickael.",
    input_schema: {
      type: "object" as const,
      required: ["title", "start", "end"],
      properties: {
        title: { type: "string", description: "Titre de la visioconférence" },
        start: { type: "string", description: "Début (ISO 8601 avec fuseau)" },
        end: { type: "string", description: "Fin (ISO 8601 avec fuseau)" },
        description: { type: "string", description: "Notes ou ordre du jour" },
        attendee_emails: {
          type: "array",
          items: { type: "string" },
          description: "E-mails des participants qui recevront le lien Meet",
        },
        force: {
          type: "boolean",
          description:
            "Créer même si un événement existe déjà sur ce créneau. FALSE par défaut. Ne mettre à TRUE qu'après confirmation explicite de Mickael.",
        },
      },
    },
  },
  {
    name: "find_free_slots",
    description:
      "Trouve N créneaux libres dans une fenêtre de temps donnée, en respectant les horaires ouvrés et en évitant la pause déjeuner. À utiliser pour « trouve-moi 3 créneaux d'1h cette semaine ». Renvoie une liste de couples (start, end) que l'utilisateur peut choisir avant qu'on crée l'événement.",
    input_schema: {
      type: "object" as const,
      required: ["duration_minutes", "from", "to"],
      properties: {
        duration_minutes: {
          type: "integer",
          description: "Durée de chaque créneau en minutes (ex: 30, 60, 120)",
        },
        from: { type: "string", description: "Début de la fenêtre de recherche (ISO 8601)" },
        to: { type: "string", description: "Fin de la fenêtre de recherche (ISO 8601)" },
        count: {
          type: "integer",
          description: "Nombre de créneaux à renvoyer (défaut 3, max 10)",
        },
        working_hours_start: {
          type: "integer",
          description: "Heure de début de journée (défaut 9)",
        },
        working_hours_end: {
          type: "integer",
          description: "Heure de fin de journée (défaut 19)",
        },
        include_sunday: {
          type: "boolean",
          description: "Autoriser le dimanche (défaut false)",
        },
        exclude_lunch: {
          type: "boolean",
          description: "Exclure la pause déjeuner 12h30-14h (défaut true)",
        },
      },
    },
  },
  // ═══ Tools inter-agents : pilotage des autres agents depuis Telegram ═══
  {
    name: "list_pending_leads",
    description:
      "Liste les leads du chatbot du site en attente de traitement (non encore notifiés à Mickael). Utile pour « Y a-t-il des leads en attente ? » ou « Récap des demandes du site ». Renvoie nom, email, date de mariage envisagée, résumé de la conversation.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "integer", description: "Nombre max de leads (défaut 5)" },
      },
    },
  },
  {
    name: "list_pending_approvals",
    description:
      "Liste les brouillons IA de réponse en attente de validation par Mickael. Utile pour « Quels sont les brouillons à valider ? ». Renvoie contact, message original, statut.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "integer", description: "Nombre max (défaut 10)" },
      },
    },
  },
  {
    name: "list_unread_messages",
    description:
      "Liste les messages du formulaire de contact du site non encore lus par Mickael. Utile pour « Nouveaux messages ? ». Renvoie nom, email, lieu, date, extrait du message.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "integer", description: "Nombre max (défaut 5)" },
      },
    },
  },
  {
    name: "list_unpaid_invoices",
    description:
      "Liste les factures non payées (agent Admin). Utile pour « Factures en attente ? » ou « Combien on m'en doit ? ». Renvoie client, montant, date d'échéance.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "integer", description: "Nombre max (défaut 10)" },
      },
    },
  },
  {
    name: "list_recent_publications",
    description:
      "Liste les publications Instagram récentes de l'agent Marketing avec leurs stats (likes, reach). Utile pour « Comment marche mon dernier post ? ».",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "integer", description: "Nombre max (défaut 5)" },
      },
    },
  },
  {
    name: "list_upcoming_weddings",
    description:
      "Liste les prochains mariages à venir depuis le CRM (admin_contacts). Renvoie nom du couple, date, lieu, jours restants. Utile pour « Mes prochains mariages ? ».",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "integer", description: "Nombre max (défaut 5)" },
      },
    },
  },
  {
    name: "create_marketing_brief",
    description:
      "Crée un brief marketing dans l'agent Marketing à partir d'un texte descriptif. Le brief sera en statut brouillon, prêt à être développé en post IG/LinkedIn/Blog depuis /admin/agents/marketing. À utiliser quand Mickael dit « Prépare un post sur le mariage de X » ou « Crée un brief marketing ».",
    input_schema: {
      type: "object" as const,
      required: ["description"],
      properties: {
        description: {
          type: "string",
          description: "Description libre du sujet à traiter (contexte, angle, ambiance)",
        },
        source_note: {
          type: "string",
          description: "Note interne facultative (ex: nom du mariage source)",
        },
      },
    },
  },
  {
    name: "create_contact",
    description:
      "Ajoute un contact (couple de mariés) au CRM admin_contacts. Utile pour « Ajoute Sophie & Marc au CRM » avec leurs coordonnées. Upsert par email si présent.",
    input_schema: {
      type: "object" as const,
      required: ["name"],
      properties: {
        name: { type: "string", description: "Nom du couple ex: 'Sophie & Marc Durand'" },
        email: { type: "string", description: "Email principal (facultatif)" },
        phone: { type: "string", description: "Téléphone principal (facultatif)" },
        wedding_date: {
          type: "string",
          description: "Date du mariage (YYYY-MM-DD, facultatif)",
        },
        wedding_location: { type: "string", description: "Lieu du mariage (facultatif)" },
        notes: { type: "string", description: "Notes libres (facultatif)" },
      },
    },
  },
  {
    name: "system_status",
    description:
      "Renvoie un récap système complet : nombre de brouillons IA en attente, messages non lus, leads chatbot, événements récents, prochain mariage. À utiliser pour « État général ? » ou en début de journée. Plus complet que /status.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ─── Exécution d'un tool call ──────────────────────────────────────────
async function runTool(
  tu: ClaudeToolUse,
  client: AuthedClient | null,
  timeZone: string
): Promise<{ result: string; ok: boolean; eventDetails?: Record<string, unknown> }> {
  // get_current_datetime ne nécessite pas de client Google.
  if (tu.name === "get_current_datetime") {
    const now = new Date();
    const today = parisYMD(now);
    const off = parisOffset(now);
    return {
      ok: true,
      // On donne l'heure de Paris explicitement (pas l'UTC, qui induirait
      // le modèle en erreur) + la date du jour ISO + le décalage courant.
      result:
        `Heure actuelle (Europe/Paris) : ${parisHuman(now)}\n` +
        `Aujourd'hui (ISO) : ${today}\n` +
        `Demain : ${addDaysYMD(today, 1)}\n` +
        `Dans une semaine : ${addDaysYMD(today, 7)}\n` +
        `Décalage horaire : ${off} (pour construire un ISO complet : YYYY-MM-DDTHH:MM:00${off})`,
    };
  }

  // ═══ Tools inter-agents (DB uniquement, pas de client Google requis) ═══
  const interAgentResult = await maybeRunInterAgentTool(tu);
  if (interAgentResult) return interAgentResult;

  if (!client) {
    return {
      ok: false,
      result:
        "ERREUR · Google Calendar n'est pas encore relié. Merci de connecter votre compte via /admin/agents/whatsapp avant d'utiliser cet outil.",
    };
  }

  try {
    switch (tu.name) {
      case "list_calendar_events": {
        const { time_min, time_max, query: q } = tu.input as {
          time_min?: string;
          time_max?: string;
          query?: string;
        };
        if (!time_min || !time_max)
          return { ok: false, result: "ERREUR · time_min et time_max sont obligatoires" };
        const r = await listEvents(client, {
          timeMinISO: time_min,
          timeMaxISO: time_max,
          query: q,
          maxResults: 30,
        });
        if (!r.ok) return { ok: false, result: `ERREUR · ${r.error}` };
        if (r.events.length === 0)
          return { ok: true, result: "Aucun événement sur cette période." };
        const lines = r.events.map((e) => {
          const s = e.start.dateTime || e.start.date || "?";
          const end = e.end.dateTime || e.end.date || "?";
          return `- [${e.id}] ${s} → ${end} · ${e.summary || "(sans titre)"}${e.location ? ` · ${e.location}` : ""}`;
        });
        return { ok: true, result: lines.join("\n") };
      }
      case "check_availability": {
        const { start, end } = tu.input as { start?: string; end?: string };
        if (!start || !end)
          return { ok: false, result: "ERREUR · start et end obligatoires" };
        const r = await isFreeSlot(client, { startISO: start, endISO: end });
        if (!r.ok) return { ok: false, result: `ERREUR · ${r.error}` };
        return {
          ok: true,
          result: r.free
            ? "OK · le créneau est libre"
            : "OCCUPÉ · il y a déjà quelque chose sur ce créneau (list_calendar_events pour détail)",
        };
      }
      case "create_event": {
        const {
          title,
          start,
          end,
          description,
          location,
          attendee_emails,
          force,
        } = tu.input as {
          title?: string;
          start?: string;
          end?: string;
          description?: string;
          location?: string;
          attendee_emails?: string[];
          force?: boolean;
        };
        if (!title || !start || !end)
          return { ok: false, result: "ERREUR · title, start et end obligatoires" };
        // Anti-collision : refuse si un RDV existe deja sur le creneau,
        // sauf si force=true (Mickael a explicitement confirme).
        if (!force) {
          const conflicts = await listEvents(client, { timeMinISO: start, timeMaxISO: end });
          // Si la VÉRIFICATION elle-même échoue, on ne crée SURTOUT pas à
          // l'aveugle (risque de doublon par-dessus un vrai RDV). On demande
          // à Mickael de réessayer ou de forcer explicitement.
          if (!conflicts.ok) {
            return {
              ok: false,
              result: `ERREUR · impossible de vérifier les conflits d'agenda (${conflicts.error}). Je n'ai rien créé pour éviter un doublon. Dis à Mickael que la vérification a échoué : il peut réessayer, ou confirmer explicitement de créer quand même (force=true).`,
            };
          }
          // On ne bloque que sur des événements RÉELLEMENT occupants : on
          // ignore les « toute la journée » (marqueurs de fond type « Enfants »,
          // anniversaires, jours fériés) et les créneaux « Disponible ».
          const busy = conflicts.events.filter(isBlockingEvent);
          if (busy.length > 0) {
            const list = busy
              .slice(0, 3)
              .map((e) => {
                const s = e.start?.dateTime || e.start?.date || "?";
                return `« ${e.summary || "sans titre"} » a ${s}`;
              })
              .join(", ");
            return {
              ok: false,
              result: `CONFLIT · Il y a deja ${list} sur ce creneau. Demande a Mickael s'il veut creer quand meme (dans ce cas rappelle le tool avec force=true) ou choisir un autre horaire.`,
            };
          }
        }
        const r = await createEvent(client, {
          summary: title,
          startISO: start,
          endISO: end,
          description,
          location,
          attendeeEmails: attendee_emails,
        });
        if (!r.ok) return { ok: false, result: `ERREUR · ${r.error}` };
        // On indique le compte agenda + le lien : Mickael doit savoir OÙ
        // l'événement a atterri (souvent il regarde un autre compte Google).
        return {
          ok: true,
          result:
            `OK · événement créé dans l'agenda ${client.calendarId} — ${r.event.summary || title}. ` +
            `Confirme à Mickael que c'est enregistré dans le compte Google « ${client.calendarId} » ` +
            `(pas un autre compte) et donne-lui le lien de vérification : ${r.event.htmlLink || "(lien indisponible)"}`,
          eventDetails: { id: r.event.id, summary: r.event.summary, htmlLink: r.event.htmlLink },
        };
      }
      case "update_event": {
        const { event_id, title, start, end, description, location } = tu.input as {
          event_id?: string;
          title?: string;
          start?: string;
          end?: string;
          description?: string;
          location?: string;
        };
        if (!event_id) return { ok: false, result: "ERREUR · event_id requis" };
        const r = await updateEvent(client, event_id, {
          summary: title,
          startISO: start,
          endISO: end,
          description,
          location,
        });
        if (!r.ok) return { ok: false, result: `ERREUR · ${r.error}` };
        return { ok: true, result: `OK · événement modifié (${r.event.summary || event_id})` };
      }
      case "delete_event": {
        const { event_id, user_confirmed } = tu.input as {
          event_id?: string;
          user_confirmed?: boolean;
        };
        if (!event_id) return { ok: false, result: "ERREUR · event_id requis" };
        if (user_confirmed !== true) {
          return {
            ok: false,
            result:
              "REFUS · confirmation utilisateur obligatoire pour supprimer. Montre le RDV a Mickael et attends son OK explicite avant de rappeler ce tool avec user_confirmed=true.",
          };
        }
        const r = await deleteEvent(client, event_id);
        if (!r.ok) return { ok: false, result: `ERREUR · ${r.error}` };
        return { ok: true, result: "OK · événement supprimé" };
      }
      case "create_event_with_meet": {
        const {
          title,
          start,
          end,
          description,
          attendee_emails,
          force,
        } = tu.input as {
          title?: string;
          start?: string;
          end?: string;
          description?: string;
          attendee_emails?: string[];
          force?: boolean;
        };
        if (!title || !start || !end)
          return { ok: false, result: "ERREUR · title, start et end obligatoires" };
        if (!force) {
          const conflicts = await listEvents(client, { timeMinISO: start, timeMaxISO: end });
          // Si la VÉRIFICATION elle-même échoue, on ne crée SURTOUT pas à
          // l'aveugle (risque de doublon par-dessus un vrai RDV). On demande
          // à Mickael de réessayer ou de forcer explicitement.
          if (!conflicts.ok) {
            return {
              ok: false,
              result: `ERREUR · impossible de vérifier les conflits d'agenda (${conflicts.error}). Je n'ai rien créé pour éviter un doublon. Dis à Mickael que la vérification a échoué : il peut réessayer, ou confirmer explicitement de créer quand même (force=true).`,
            };
          }
          // On ne bloque que sur des événements RÉELLEMENT occupants : on
          // ignore les « toute la journée » (marqueurs de fond type « Enfants »,
          // anniversaires, jours fériés) et les créneaux « Disponible ».
          const busy = conflicts.events.filter(isBlockingEvent);
          if (busy.length > 0) {
            const list = busy
              .slice(0, 3)
              .map((e) => {
                const s = e.start?.dateTime || e.start?.date || "?";
                return `« ${e.summary || "sans titre"} » a ${s}`;
              })
              .join(", ");
            return {
              ok: false,
              result: `CONFLIT · Il y a deja ${list} sur ce creneau. Demande a Mickael s'il veut creer quand meme (dans ce cas rappelle le tool avec force=true) ou choisir un autre horaire.`,
            };
          }
        }
        const r = await createEventWithMeet(client, {
          summary: title,
          startISO: start,
          endISO: end,
          description,
          attendeeEmails: attendee_emails,
        });
        if (!r.ok) return { ok: false, result: `ERREUR · ${r.error}` };
        const link = (r.event as { hangoutLink?: string }).hangoutLink || "(lien Meet en cours de génération)";

        // Bonus : envoie un email de confirmation à chaque participant
        // avec le lien Meet + la date lisible. Best-effort, on n'échoue
        // pas le tool si le mail plante.
        // Emails de confirmation : on COMPTE les succès réels (ne pas
        // affirmer « N envoyés » si certains ont échoué silencieusement).
        let mailsSent = 0;
        const mailsTotal = attendee_emails?.length ?? 0;
        if (attendee_emails && attendee_emails.length > 0) {
          try {
            const { sendMail } = await import("@/lib/mailer");
            // Source fuseau-cohérente pour l'email : on privilégie l'heure
            // renvoyée par Google (start.dateTime porte l'offset correct pour
            // la date de l'événement). À défaut, si l'entrée brute n'a pas
            // d'offset, on lui adjoint celui de Paris — sinon new Date() la
            // lirait en UTC serveur (email décalé de 1-2 h vs le vrai RDV).
            const startForEmail =
              r.event.start?.dateTime ||
              (/([+-]\d{2}:?\d{2}|Z)$/.test(start) ? start : `${start}${parisOffset(new Date(start))}`);
            const humanDate = new Date(startForEmail).toLocaleString("fr-FR", {
              timeZone: "Europe/Paris",
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            for (const email of attendee_emails) {
              const emailText = `Bonjour,

C'est confirmé : nous avons rendez-vous le ${humanDate} pour « ${title} ».

${link.startsWith("http") ? `Lien Google Meet :\n${link}\n\n` : ""}${description ? `Notes : ${description}\n\n` : ""}À très vite,
Mickael Romero
Romero Photography
https://romerophotography.fr`;
              try {
                const mr = await sendMail({
                  to: email,
                  subject: `Confirmation RDV — ${humanDate}`,
                  text: emailText,
                  replyTo: "romerophotography.contact@gmail.com",
                });
                if (mr.sent) mailsSent++;
                else console.warn(`[assistant] email ${email} non envoyé :`, mr.error);
              } catch (e) {
                console.warn(`[assistant] email confirmation ${email} échec :`, e);
              }
            }
          } catch (e) {
            console.warn("[assistant] envoi emails confirmation échoué :", e);
          }
        }
        const mailInfo =
          mailsTotal === 0
            ? ""
            : mailsSent === mailsTotal
            ? ` ${mailsSent} email(s) de confirmation envoyé(s) aux participants.`
            : ` ATTENTION : seulement ${mailsSent}/${mailsTotal} email(s) de confirmation ont pu partir — préviens Mickael que les autres participants n'ont PAS reçu de confirmation.`;

        return {
          ok: true,
          result:
            `OK · visio créée avec Meet dans l'agenda ${client.calendarId} — ${r.event.summary || title}. ` +
            `Confirme à Mickael que c'est dans son compte Google « ${client.calendarId} », ` +
            `donne le lien Meet ${link} et le lien agenda ${(r.event as { htmlLink?: string }).htmlLink || ""}.` +
            mailInfo,
          eventDetails: {
            id: r.event.id,
            summary: r.event.summary,
            hangoutLink: link,
          },
        };
      }
      case "find_free_slots": {
        const {
          duration_minutes,
          from,
          to,
          count,
          working_hours_start,
          working_hours_end,
          include_sunday,
          exclude_lunch,
        } = tu.input as {
          duration_minutes?: number;
          from?: string;
          to?: string;
          count?: number;
          working_hours_start?: number;
          working_hours_end?: number;
          include_sunday?: boolean;
          exclude_lunch?: boolean;
        };
        if (!duration_minutes || !from || !to)
          return {
            ok: false,
            result: "ERREUR · duration_minutes, from et to obligatoires",
          };
        const cap = Math.min(10, Math.max(1, count ?? 3));
        const r = await findFreeSlots(client, {
          durationMinutes: duration_minutes,
          fromISO: from,
          toISO: to,
          count: cap,
          workingHoursStart: working_hours_start,
          workingHoursEnd: working_hours_end,
          includeSunday: include_sunday,
          excludeLunch: exclude_lunch,
        });
        if (!r.ok) return { ok: false, result: `ERREUR · ${r.error}` };
        if (r.slots.length === 0)
          return { ok: true, result: "Aucun créneau libre trouvé dans la fenêtre." };
        const lines = r.slots.map((s, i) => {
          const start = new Date(s.startISO).toLocaleString("fr-FR", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone,
          });
          const end = new Date(s.endISO).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone,
          });
          return `${i + 1}. ${start} → ${end}`;
        });
        return { ok: true, result: lines.join("\n") };
      }
      default:
        return { ok: false, result: `ERREUR · outil inconnu ${tu.name}` };
    }
  } catch (e) {
    console.error(`[assistant/tool ${tu.name}]`, e);
    return { ok: false, result: "ERREUR · échec technique, la conversation continue" };
  }
}

// ═══ Handlers inter-agents (DB, indépendants de Google Calendar) ═══
async function maybeRunInterAgentTool(
  tu: ClaudeToolUse
): Promise<{ result: string; ok: boolean } | null> {
  try {
    switch (tu.name) {
      case "list_pending_leads": {
        const { limit = 5 } = tu.input as { limit?: number };
        const rows = await query<{
          id: number;
          lead_data: Record<string, unknown>;
          updated_at: string;
        }>(
          `SELECT id, lead_data, updated_at FROM chat_conversations
           WHERE notified = FALSE ORDER BY updated_at DESC LIMIT $1`,
          [Math.min(limit, 20)]
        ).catch(() => []);
        if (rows.length === 0) return { ok: true, result: "Aucun lead en attente." };
        const lines = rows.map((r) => {
          const ld = r.lead_data || {};
          const name = (ld.contact_name as string) || (ld.contact_email as string) || `Visiteur #${r.id}`;
          const email = ld.contact_email as string | undefined;
          const date = ld.wedding_date as string | undefined;
          const loc = ld.wedding_location as string | undefined;
          return `- ${name}${email ? ` (${email})` : ""}${date ? ` · ${date}` : ""}${loc ? ` · ${loc}` : ""}`;
        });
        return { ok: true, result: `${rows.length} lead(s) en attente :\n${lines.join("\n")}` };
      }
      case "list_pending_approvals": {
        const { limit = 10 } = tu.input as { limit?: number };
        const rows = await query<{
          id: number;
          contact_name: string;
          contact_email: string;
          source: string;
          created_at: string;
        }>(
          `SELECT id, contact_name, contact_email, source, created_at
           FROM pending_approvals WHERE status = 'pending'
           ORDER BY created_at DESC LIMIT $1`,
          [Math.min(limit, 20)]
        ).catch(() => []);
        if (rows.length === 0)
          return { ok: true, result: "Aucun brouillon IA en attente. Tout est traité." };
        const lines = rows.map(
          (r) => `- #${r.id} · ${r.contact_name} (${r.source}) · ${r.contact_email}`
        );
        return {
          ok: true,
          result: `${rows.length} brouillon(s) à valider :\n${lines.join("\n")}\n\nOuvrir : https://romerophotography.fr/admin/approvals`,
        };
      }
      case "list_unread_messages": {
        const { limit = 5 } = tu.input as { limit?: number };
        const rows = await query<{
          id: number;
          first_name: string;
          last_name: string;
          email: string;
          place: string;
          message: string;
          created_at: string;
        }>(
          `SELECT id, first_name, last_name, email, place, message, created_at
           FROM messages WHERE read_at IS NULL
           ORDER BY created_at DESC LIMIT $1`,
          [Math.min(limit, 20)]
        ).catch(() => []);
        if (rows.length === 0) return { ok: true, result: "Aucun message non lu." };
        const lines = rows.map(
          (r) =>
            `- ${r.first_name} ${r.last_name} (${r.email})${r.place ? ` · ${r.place}` : ""} : « ${r.message.slice(0, 80)}${r.message.length > 80 ? "…" : ""} »`
        );
        return { ok: true, result: `${rows.length} message(s) non lu(s) :\n${lines.join("\n")}` };
      }
      case "list_unpaid_invoices": {
        const { limit = 10 } = tu.input as { limit?: number };
        const rows = await query<{
          id: number;
          reference: string;
          client_name: string;
          amount_cents: number;
          due_date: string | null;
        }>(
          `SELECT id, reference, client_name, amount_cents, to_char(due_date, 'YYYY-MM-DD') as due_date
           FROM admin_documents WHERE type = 'invoice' AND status IN ('sent','overdue')
           ORDER BY due_date ASC NULLS LAST LIMIT $1`,
          [Math.min(limit, 20)]
        ).catch(() => []);
        if (rows.length === 0) return { ok: true, result: "Aucune facture impayée." };
        const total = rows.reduce((a, r) => a + r.amount_cents, 0);
        const lines = rows.map(
          (r) =>
            `- ${r.reference} · ${r.client_name} : ${(r.amount_cents / 100).toFixed(0)} €${r.due_date ? ` (échéance ${r.due_date})` : ""}`
        );
        return {
          ok: true,
          result: `${rows.length} facture(s) impayée(s) · total ${(total / 100).toFixed(0)} € :\n${lines.join("\n")}`,
        };
      }
      case "list_recent_publications": {
        const { limit = 5 } = tu.input as { limit?: number };
        const rows = await query<{
          id: number;
          instagram_caption: string;
          published_at: string;
          insights: Record<string, unknown> | null;
        }>(
          `SELECT id, LEFT(instagram_caption, 60) as instagram_caption,
                  to_char(instagram_published_at, 'YYYY-MM-DD') as published_at,
                  instagram_insights as insights
           FROM marketing_briefs
           WHERE instagram_status = 'published'
           ORDER BY instagram_published_at DESC LIMIT $1`,
          [Math.min(limit, 10)]
        ).catch(() => []);
        if (rows.length === 0) return { ok: true, result: "Aucune publication IG récente." };
        const lines = rows.map((r) => {
          const insights = r.insights || {};
          const likes = insights.likes ?? "?";
          const reach = insights.reach ?? "?";
          return `- ${r.published_at} · « ${r.instagram_caption || "(sans caption)"}… » · ${likes} likes / ${reach} reach`;
        });
        return { ok: true, result: `${rows.length} dernière(s) publication(s) :\n${lines.join("\n")}` };
      }
      case "list_upcoming_weddings": {
        const { limit = 5 } = tu.input as { limit?: number };
        const rows = await query<{
          id: number;
          name: string;
          wedding_date: string;
          wedding_location: string | null;
          days_until: number;
        }>(
          `SELECT id, name,
                  to_char(wedding_date, 'YYYY-MM-DD') as wedding_date,
                  wedding_location,
                  (wedding_date - CURRENT_DATE) AS days_until
           FROM admin_contacts
           WHERE wedding_date IS NOT NULL AND wedding_date >= CURRENT_DATE
           ORDER BY wedding_date ASC LIMIT $1`,
          [Math.min(limit, 10)]
        ).catch(() => []);
        if (rows.length === 0)
          return { ok: true, result: "Aucun mariage à venir dans le CRM." };
        const lines = rows.map(
          (r) =>
            `- ${r.name} · ${r.wedding_date} (J-${r.days_until})${r.wedding_location ? ` · ${r.wedding_location}` : ""}`
        );
        return { ok: true, result: `${rows.length} mariage(s) à venir :\n${lines.join("\n")}` };
      }
      case "create_marketing_brief": {
        const { description, source_note } = tu.input as {
          description?: string;
          source_note?: string;
        };
        if (!description || description.trim().length < 10)
          return { ok: false, result: "ERREUR · description trop courte (min 10 chars)" };
        const row = await queryOne<{ id: number }>(
          `INSERT INTO marketing_briefs (brief_text, source_note)
           VALUES ($1, $2) RETURNING id`,
          [description, source_note ?? ""]
        ).catch((e) => {
          throw new Error(`INSERT marketing_briefs échoué : ${e.message}`);
        });
        if (!row) return { ok: false, result: "ERREUR · brief non créé" };
        return {
          ok: true,
          result: `✓ Brief marketing #${row.id} créé. Développe-le en post IG/LinkedIn/Blog depuis /admin/agents/marketing`,
        };
      }
      case "create_contact": {
        const { name, email, phone, wedding_date, wedding_location, notes } =
          tu.input as {
            name?: string;
            email?: string;
            phone?: string;
            wedding_date?: string;
            wedding_location?: string;
            notes?: string;
          };
        if (!name || name.trim().length < 2)
          return { ok: false, result: "ERREUR · nom obligatoire" };
        // Upsert par email si présent, sinon par nom
        let existing: { id: number } | null = null;
        if (email) {
          existing = await queryOne<{ id: number }>(
            `SELECT id FROM admin_contacts WHERE LOWER(email) = LOWER($1)`,
            [email]
          ).catch(() => null);
        }
        if (!existing) {
          existing = await queryOne<{ id: number }>(
            `SELECT id FROM admin_contacts WHERE LOWER(name) = LOWER($1)`,
            [name]
          ).catch(() => null);
        }
        if (existing) {
          // On NE swallow PAS l'erreur : un UPDATE échoué (ex. date invalide
          // « le 12 juin » qui casse le cast ::date) doit être remonté à
          // Mickael, pas maquillé en « ✓ mis à jour » mensonger.
          const updErr = await execute(
            `UPDATE admin_contacts SET
               email = COALESCE(NULLIF(email, ''), $1),
               phone = COALESCE(NULLIF(phone, ''), $2),
               wedding_date = COALESCE(wedding_date, NULLIF($3, '')::date),
               wedding_location = COALESCE(NULLIF(wedding_location, ''), $4),
               notes = COALESCE(NULLIF(notes, ''), $5),
               updated_at = NOW()
             WHERE id = $6`,
            [email ?? "", phone ?? "", wedding_date ?? "", wedding_location ?? "", notes ?? "", existing.id]
          ).then(() => null).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));
          if (updErr)
            return {
              ok: false,
              result: `ERREUR · mise à jour du contact ${name} échouée (${updErr.message}). Vérifie le format des infos (surtout la date : format AAAA-MM-JJ).`,
            };
          return { ok: true, result: `✓ Contact ${name} mis à jour (id #${existing.id})` };
        }
        const row = await queryOne<{ id: number }>(
          `INSERT INTO admin_contacts (name, email, phone, wedding_date, wedding_location, notes)
           VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, '')::date, NULLIF($5, ''), NULLIF($6, ''))
           RETURNING id`,
          [name, email ?? "", phone ?? "", wedding_date ?? "", wedding_location ?? "", notes ?? ""]
        ).catch((e) => {
          throw new Error(`INSERT admin_contacts échoué : ${e.message}`);
        });
        return { ok: true, result: `✓ Contact ${name} ajouté au CRM (id #${row?.id ?? "?"})` };
      }
      case "system_status": {
        const [approvals, msgs, leads, invoices, wedding] = await Promise.all([
          queryOne<{ c: number }>(
            `SELECT COUNT(*)::int as c FROM pending_approvals WHERE status = 'pending'`
          ).catch(() => null),
          queryOne<{ c: number }>(
            `SELECT COUNT(*)::int as c FROM messages WHERE read_at IS NULL`
          ).catch(() => null),
          queryOne<{ c: number }>(
            `SELECT COUNT(*)::int as c FROM chat_conversations WHERE notified = FALSE`
          ).catch(() => null),
          queryOne<{ c: number; total: number }>(
            `SELECT COUNT(*)::int as c, COALESCE(SUM(amount_cents),0)::int as total
             FROM admin_documents WHERE type = 'invoice' AND status IN ('sent','overdue')`
          ).catch(() => null),
          queryOne<{ name: string; date: string; days: number }>(
            `SELECT name, to_char(wedding_date, 'YYYY-MM-DD') as date,
                    (wedding_date - CURRENT_DATE) AS days
             FROM admin_contacts
             WHERE wedding_date IS NOT NULL AND wedding_date >= CURRENT_DATE
             ORDER BY wedding_date ASC LIMIT 1`
          ).catch(() => null),
        ]);
        const lines = [
          `📊 État système :`,
          `- Brouillons IA en attente : ${approvals?.c ?? "?"}`,
          `- Messages non lus : ${msgs?.c ?? "?"}`,
          `- Leads chatbot en attente : ${leads?.c ?? "?"}`,
          `- Factures impayées : ${invoices?.c ?? "?"} (${((invoices?.total ?? 0) / 100).toFixed(0)} €)`,
        ];
        if (wedding)
          lines.push(`- Prochain mariage : ${wedding.name} le ${wedding.date} (J-${wedding.days})`);
        return { ok: true, result: lines.join("\n") };
      }
      default:
        // Ce n'est pas un tool inter-agent — on laisse le switch principal gérer
        return null;
    }
  } catch (e) {
    console.error(`[assistant/inter-agent ${tu.name}]`, e);
    return { ok: false, result: "ERREUR · échec technique inter-agent" };
  }
}

// ─── Boucle principale ─────────────────────────────────────────────────
export type RunResult =
  | { ok: true; reply: string; tools_used: string[] }
  | { ok: false; error: string };

export async function runAssistant(input: {
  platform: Platform;
  platformUserId: string;
  displayName?: string | null;
  message: string;
}): Promise<RunResult> {
  try {
    if (!input.message.trim()) return { ok: false, error: "Message vide" };

    // 1. Configuration de l'agent
    const inst = await getAgent("whatsapp");
    if (!inst) return { ok: false, error: "Agent WhatsApp indisponible" };
    const cfg = inst.config as {
      anthropic_api_key?: string;
      google_client_id?: string;
      google_client_secret?: string;
      google_refresh_token?: string;
      google_calendar_id?: string;
      google_timezone?: string;
    };
    if (!cfg.anthropic_api_key && !process.env.OPENROUTER_API_KEY)
      return {
        ok: false,
        error: "Clé Claude manquante — configurez-la dans /admin/agents/whatsapp ou activez OpenRouter.",
      };

    // 2. Client Google (peut être absent — les outils renverront une
    // erreur explicite que Claude verbalisera).
    let calClient: AuthedClient | null = null;
    let calError: string | null = null;
    if (cfg.google_client_id && cfg.google_client_secret && cfg.google_refresh_token) {
      const client = await buildClient({
        refreshToken: cfg.google_refresh_token,
        clientId: cfg.google_client_id,
        clientSecret: cfg.google_client_secret,
        calendarId: cfg.google_calendar_id,
        timeZone: cfg.google_timezone,
      });
      if (client.ok) calClient = client.client;
      else calError = client.error;
    }
    const timeZone = cfg.google_timezone || "Europe/Paris";

    // 3. Session
    const session = await getOrCreateSession({
      platform: input.platform,
      platformUserId: input.platformUserId,
      displayName: input.displayName,
    });

    // 4. Historique (limité, ordre chronologique)
    const history = await listSessionMessages(session.id);

    // 5. Reconstruit messages pour Claude.
    //
    // ⚠️ Piège critique (source de HTTP 400 « messages » qui cassaient la
    // session Telegram sur TOUS les messages suivants) : quand un tour appelle
    // PLUSIEURS outils en parallèle, la BDD stocke 1 ligne assistant (avec le
    // tableau complet de blocs, dont N tool_use) suivie de N lignes 'tool'
    // distinctes. L'API Claude EXIGE que les N tool_result vivent dans UN SEUL
    // message user qui suit immédiatement l'assistant. Il faut donc FUSIONNER
    // les lignes 'tool' consécutives d'un même tour dans un unique message user.
    const built: ClaudeMessage[] = [];
    for (const m of history) {
      if (m.role === "user") {
        built.push({ role: "user", content: m.content });
      } else if (m.role === "assistant") {
        if (m.tool_calls && Array.isArray(m.tool_calls)) {
          built.push({ role: "assistant", content: m.tool_calls as ClaudeContentBlock[] });
        } else {
          built.push({ role: "assistant", content: m.content });
        }
      } else if (m.role === "tool") {
        try {
          const parsed = JSON.parse(m.content) as { tool_use_id: string; content: string };
          const block: ClaudeToolResult = {
            type: "tool_result",
            tool_use_id: parsed.tool_use_id,
            content: parsed.content,
          };
          const prev = built[built.length - 1];
          const prevIsToolBatch =
            prev &&
            prev.role === "user" &&
            Array.isArray(prev.content) &&
            (prev.content[0] as { type?: string } | undefined)?.type === "tool_result";
          if (prevIsToolBatch) {
            // même tour → on empile le tool_result dans le message user existant
            (prev!.content as ClaudeToolResult[]).push(block);
          } else {
            built.push({ role: "user", content: [block] });
          }
        } catch {
          /* ignore tool_result corrompu */
        }
      }
    }

    // Normalise les bords de la fenêtre glissante (LIMIT MAX_HISTORY_MESSAGES) :
    // elle peut couper au milieu d'un tour à outils et laisser des orphelins que
    // l'API rejette (400). On garantit : ouverture sur un vrai message user, et
    // pas de tool_use en suspens juste avant le nouveau message user qu'on ajoute.
    const isToolResultMsg = (msg: ClaudeMessage) =>
      Array.isArray(msg.content) &&
      (msg.content[0] as { type?: string } | undefined)?.type === "tool_result";
    const hasToolUse = (msg: ClaudeMessage) =>
      Array.isArray(msg.content) &&
      (msg.content as Array<{ type?: string }>).some((b) => b.type === "tool_use");
    let changed = true;
    while (changed) {
      changed = false;
      // Ouverture : un tool_result orphelin ou un assistant en tête = invalide.
      while (built.length && (built[0].role === "assistant" || isToolResultMsg(built[0]))) {
        built.shift();
        changed = true;
      }
      // Fin : un tool_use sans réponse, ou un message user en dernier (deux user
      // d'affilée après l'ajout du message courant) = invalide.
      while (built.length) {
        const last = built[built.length - 1];
        if ((last.role === "assistant" && hasToolUse(last)) || last.role === "user") {
          built.pop();
          changed = true;
        } else break;
      }
    }

    const claudeMessages: ClaudeMessage[] = built;
    claudeMessages.push({ role: "user", content: input.message });

    // 6. Persistance du user message
    await query(
      `INSERT INTO assistant_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
      [session.id, input.message]
    );

    // 7. System prompt
    const kb = await listKnowledge("whatsapp");
    const kbBlock = kb.length
      ? "\n\n# BASE DE CONNAISSANCES\n" +
        kb.map((k) => `## ${k.title} [${k.category}]\n${k.content}`).join("\n\n")
      : "";
    const STYLE_RULES = `\n\n## RÈGLES DE STYLE — À RESPECTER STRICTEMENT
- N'utilise JAMAIS de markdown : pas de **gras**, pas de *italique*, pas de listes à tirets avec -, pas de ### titres.
- Écris en français, texte brut, comme dans un vrai message Telegram/WhatsApp.
- Phrases courtes, direct et efficace (tu parles à Mickael, il est occupé).
- Pour lister deux ou trois options, écris-les à la suite dans la phrase, séparées par des tirets simples. Jamais de puces à part.
- Pas de « c'est noté ! » redondant : va directement à la question ou l'action.`;
    const SAFETY_RULES = `\n\n## RÈGLES DE SÉCURITÉ AGENDA — CRITIQUE, NE JAMAIS DÉROGER
Tu manipules le VRAI agenda de Mickael. Une erreur = un vrai RDV perdu. Applique ces règles à la lettre :

1. Anti-collision. Avant de créer un RDV, le tool vérifie automatiquement les conflits. Si CONFLIT est retourné, ne force PAS tout de suite : réponds d'abord « Il y a déjà [détail du conflit] à cette heure. Tu veux quand même le poser par-dessus, ou choisir un autre créneau ? » et attends sa réponse EXPLICITE. DÈS QUE Mickael confirme (« oui », « oui vas-y », « pose-le quand même »), tu DOIS OBLIGATOIREMENT rappeler create_event / create_event_with_meet avec force=true — c'est le SEUL moyen de créer réellement l'événement par-dessus le conflit. NE dis JAMAIS « c'est créé » sans avoir rappelé le tool avec force=true et reçu un résultat OK : sinon rien n'est enregistré et tu mens à Mickael.

2. Confirmation avant destruction. Pour delete_event : TOUJOURS demander « Confirme-tu la suppression de [titre du RDV] à [heure] ? » avant d'appeler le tool. JAMAIS de suppression au premier coup. Pareil pour update_event si le changement est majeur (déplacement, changement de participant).

3. Ambiguïté = clarification. Si Mickael dit « annule mon RDV » sans préciser lequel, appelle list_calendar_events pour lister les prochains, puis demande « lequel ? ». JAMAIS supprimer au petit bonheur.

4. Ne jamais inventer. Si un email, téléphone, nom de client ou lieu n'est pas donné par Mickael, laisse le champ vide — ne devine pas. Pas de « client@example.com ».

5. Créneaux inhabituels. Si un RDV est demandé le samedi/dimanche, avant 8 h, ou après 22 h, demande confirmation : « Tu veux vraiment poser ça un dimanche à 21 h ? ».

6. Durées par défaut. Si Mickael ne précise pas la durée, propose 30 min et attends validation avant de créer. Ne mets pas 1 h ou 15 min au hasard.

7. Titre obligatoire. Un événement doit avoir un titre explicite. Si Mickael dit juste « RDV mardi 15 h », demande « avec qui / pour quoi ? » avant de créer.

8. Fuseau horaire. Tu es TOUJOURS en Europe/Paris. Toutes les dates que tu génères doivent inclure le fuseau (+01:00 hiver / +02:00 été). Si Mickael dit une heure sans préciser, c'est heure de Paris.

9. Vocaux mal compris. Si la transcription est ambiguë (une heure floue, un jour peu clair), REPÈTE ce que tu as compris avant d'agir : « Tu me demandes de poser un RDV mardi 12 novembre à 15 h 20, c'est bien ça ? ».

10. Pas d'action en cascade. Une intention utilisateur = maximum une action agenda. Si Mickael demande « annule mardi et crée mercredi », traite ça en 2 étapes avec confirmations séparées.

11. Après création/modification. Répète en une ligne ce qui a été fait, avec date-heure lisible et titre. Ex : « Créé : dentiste demain 15 h 20 ». Pas juste « c'est fait ». IMPORTANT : précise TOUJOURS dans quel compte Google l'événement a été enregistré (celui indiqué par le tool) et donne le lien de vérification quand le tool le fournit — Mickael consulte parfois un autre compte Google et croit que rien n'a été enregistré.

12. Erreur = jamais silencieux. Si un tool renvoie une erreur, dis-le à Mickael en clair, ne masque pas.

13. JAMAIS de fausse confirmation. Tu ne dis « c'est créé / modifié / supprimé / enregistré » QUE si le tool correspondant a été appelé DANS CE MÊME échange ET a renvoyé un résultat OK. Interdiction absolue d'annoncer une action réussie sur la foi d'un « oui » de Mickael sans avoir réellement rappelé le tool. Si tu as demandé une confirmation (conflit, suppression, doute) et que Mickael confirme, ta PROCHAINE action est l'appel du tool — pas un message « c'est fait ». En cas de doute sur l'état réel, appelle list_calendar_events pour vérifier avant d'affirmer quoi que ce soit.`;
    let systemPrompt =
      effectivePrompt(inst) +
      `\n\n## CONTEXTE TECHNIQUE\n- Fuseau horaire : ${timeZone}\n- Plateforme : ${input.platform}\n- Nom de l'utilisateur : ${input.displayName ?? "(inconnu)"}` +
      parisTimeContext() +
      SAFETY_RULES +
      STYLE_RULES +
      kbBlock;
    if (!calClient && calError) {
      systemPrompt += `\n\n## AVERTISSEMENT\nGoogle Calendar n'est PAS connecté (${calError}). Réponds à Mickael que la connexion agenda doit être établie via /admin/agents/whatsapp avant que tu puisses gérer ses rendez-vous.`;
    } else if (!calClient) {
      systemPrompt += `\n\n## AVERTISSEMENT\nGoogle Calendar n'est PAS encore connecté. Réponds à Mickael de connecter son compte via /admin/agents/whatsapp.`;
    }

    // 8. Boucle Claude + tool-use
    const toolsUsed: string[] = [];
    const collectedText: string[] = [];
    let lastAssistantBlocks: ClaudeContentBlock[] = [];
    let completedCleanly = false;

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const t0 = Date.now();
      const resp = await callClaude({
        apiKey: cfg.anthropic_api_key || "",
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
        await query(
          `INSERT INTO assistant_messages (session_id, role, content, duration_ms)
           VALUES ($1, 'assistant', $2, $3)`,
          [session.id, turnText || "(vide)", duration]
        );
        completedCleanly = true;
        break;
      }

      // Exécute les tools EN AMONT (avant persistance) pour ne rien
      // écrire si l'API Claude nous a menti sur le format.
      const executions: Array<{ tu: ClaudeToolUse; result: string; ok: boolean }> = [];
      for (const tu of toolUses) {
        toolsUsed.push(tu.name);
        const r = await runTool(tu, calClient, timeZone);
        executions.push({ tu, result: r.result, ok: r.ok });
      }

      // Transaction : assistant + tous les tool_results
      await withTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO assistant_messages (session_id, role, content, tool_calls, duration_ms)
           VALUES ($1, 'assistant', $2, $3::jsonb, $4)`,
          [session.id, turnText, JSON.stringify(resp.content), duration]
        );
        for (const ex of executions) {
          await tx.execute(
            `INSERT INTO assistant_messages (session_id, role, content) VALUES ($1, 'tool', $2)`,
            [session.id, JSON.stringify({ tool_use_id: ex.tu.id, content: ex.result })]
          );
        }
      });

      // Events stats (hors chemin critique)
      for (const ex of executions) {
        logEvent("whatsapp", ex.tu.name, { input: ex.tu.input }, ex.ok).catch(() => {});
      }

      claudeMessages.push({ role: "assistant", content: resp.content });
      claudeMessages.push({
        role: "user",
        content: executions.map((ex) => ({
          type: "tool_result",
          tool_use_id: ex.tu.id,
          content: ex.result,
        })),
      });
    }

    // Si on a épuisé MAX_TOOL_TURNS SANS conclure (dernier tour = encore des
    // outils), les actions ont bien été exécutées mais Claude n'a jamais
    // formulé de confirmation → Mickael se retrouverait sans retour clair
    // (« l'agent dit rien alors qu'il a créé le RDV »). On force donc une
    // synthèse finale SANS outils pour garantir une vraie confirmation.
    if (!completedCleanly) {
      try {
        const wrap = await callClaude({
          apiKey: cfg.anthropic_api_key || "",
          system: systemPrompt,
          messages: claudeMessages,
          noTools: true,
        });
        const wrapText = wrap.content
          .filter((b): b is ClaudeText => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        if (wrapText) {
          collectedText.push(wrapText);
          lastAssistantBlocks = wrap.content;
          await query(
            `INSERT INTO assistant_messages (session_id, role, content) VALUES ($1, 'assistant', $2)`,
            [session.id, wrapText]
          );
        }
      } catch (e) {
        console.warn("[whatsapp] synthèse finale (noTools) a échoué :", e);
      }
    }

    let finalText = collectedText.join("\n\n").trim();
    if (!finalText) {
      const fallback = lastAssistantBlocks
        .filter((b): b is ClaudeText => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      finalText = fallback || "Je n'ai pas pu formuler de réponse — reformule ta demande ?";
    }

    // Compteur + log turn
    await query(
      `UPDATE assistant_sessions SET message_count = message_count + 2, updated_at = NOW() WHERE id = $1`,
      [session.id]
    );
    logEvent("whatsapp", "assistant_turn", {
      session_id: session.id,
      tools_used: toolsUsed,
      reply_chars: finalText.length,
    }).catch(() => {});

    return { ok: true, reply: finalText, tools_used: toolsUsed };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[assistant] error:", err);
    logEvent("whatsapp", "assistant_error", { error: err }, false).catch(() => {});
    return { ok: false, error: err };
  }
}

// ─── Claude API ────────────────────────────────────────────────────────
async function callClaude(input: {
  apiKey: string;
  system: string;
  messages: ClaudeMessage[];
  /** true = force une réponse texte finale (aucun outil proposé) */
  noTools?: boolean;
}): Promise<ClaudeResponse> {
  const ep = getClaudeEndpoint({ userApiKey: input.apiKey, model: CLAUDE_MODEL });
  const resp = await fetch(ep.url, {
    method: "POST",
    headers: ep.headers,
    body: JSON.stringify({
      model: ep.model,
      max_tokens: 1024,
      system: cachedSystem(input.system),
      ...(input.noTools ? {} : { tools: TOOLS }),
      messages: input.messages,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Claude HTTP ${resp.status} · ${txt.slice(0, 400)}`);
  }
  return (await resp.json()) as ClaudeResponse;
}
