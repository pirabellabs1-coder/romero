// ──────────────────────────────────────────────────────────────────────
// Google Calendar API wrapper — OAuth 2 + CRUD + recherche de créneaux
// ──────────────────────────────────────────────────────────────────────
//
// Objectifs de conception :
//   1. Zéro dépendance externe. On appelle l'API REST via fetch — inutile
//      d'ajouter `googleapis` (poids et complexité) pour 5 endpoints.
//   2. Refresh token stocké dans agent_installations.config (JSONB).
//      L'access_token est ré-obtenu à chaque appel : ça coûte ~150 ms
//      mais ça évite un cache à invalider et un état à gérer.
//   3. Toutes les erreurs sont typées : { ok:true, ... } | { ok:false, error }.
//      Jamais de throw silencieux.
//   4. Fuseau horaire par défaut Europe/Paris — Mickael est niçois.
//      Peut être overridé via la config de l'agent.
//   5. Les datetimes sont TOUJOURS traitées en UTC dans le code, en local
//      dans l'UI. Google renvoie du RFC 3339 ; on ne parse que ce qu'il
//      faut, on ne re-formate pas.
//
// Ressources utiles :
//   - Calendar API v3   : https://developers.google.com/calendar/api/v3/reference
//   - OAuth 2 pour app  : https://developers.google.com/identity/protocols/oauth2/web-server
//

const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const OAUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3";

// ─── Types ─────────────────────────────────────────────────────────────
export type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  htmlLink?: string;
  status?: string;
  /** "transparent" = marqué « Disponible » (ne bloque pas) ; sinon "opaque" */
  transparency?: string;
  /** "default" | "outOfOffice" | "focusTime" | "workingLocation" … */
  eventType?: string;
};

// ─── Anti-collision : qu'est-ce qui BLOQUE réellement un créneau ? ────────
// Un événement ne doit provoquer un « conflit » que s'il occupe vraiment le
// temps de Mickael. On ignore :
//   - les événements « toute la journée » (start.date sans heure) : ce sont
//     des marqueurs de fond (anniversaires, « Enfants », jours fériés) qui
//     recouvrent 24 h et bloqueraient sinon TOUT RDV horaire de la journée ;
//   - les événements marqués « Disponible » (transparency = "transparent") ;
//   - les entrées de type lieu de travail / hors-bureau (workingLocation).
// C'est exactement ainsi que Google calcule le free/busy.
export function isBlockingEvent(e: CalendarEvent): boolean {
  if (!e.start?.dateTime) return false; // toute la journée → non bloquant
  if (e.transparency === "transparent") return false; // « Disponible »
  if (e.eventType === "workingLocation") return false;
  if (e.status === "cancelled") return false;
  return true;
}

export type CreateEventInput = {
  summary: string;
  description?: string;
  location?: string;
  startISO: string; // "2027-06-15T14:00:00+02:00" ou "2027-06-15T12:00:00Z"
  endISO: string;
  timeZone?: string;
  attendeeEmails?: string[];
};

// ─── OAuth ─────────────────────────────────────────────────────────────
export function buildAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state?: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: OAUTH_SCOPES,
    access_type: "offline", // pour obtenir un refresh_token
    prompt: "consent", // force le refresh_token à chaque re-autorisation
    include_granted_scopes: "true",
  });
  if (input.state) params.set("state", input.state);
  return `${OAUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCodeForTokens(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<
  | { ok: true; tokens: GoogleTokens }
  | { ok: false; error: string }
> {
  const params = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  try {
    const resp = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `HTTP ${resp.status} · ${text.slice(0, 300)}` };
    }
    const tokens = (await resp.json()) as GoogleTokens;
    if (!tokens.refresh_token) {
      return {
        ok: false,
        error:
          "Google n'a pas renvoyé de refresh_token — probablement une autorisation antérieure. Réessayer avec prompt=consent (déjà en place) ou révoquer l'accès dans myaccount.google.com/permissions puis réessayer.",
      };
    }
    return { ok: true, tokens };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function refreshAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<
  | { ok: true; accessToken: string; expiresIn: number }
  | { ok: false; error: string }
> {
  const params = new URLSearchParams({
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "refresh_token",
  });
  try {
    const resp = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!resp.ok) {
      const text = await resp.text();
      // invalid_grant = refresh_token expiré ou révoqué. Cause fréquente : app
      // OAuth Google restée en mode « Test » (Google révoque alors les refresh
      // tokens tous les 7 jours). Message actionnable pour l'agent/l'admin.
      if (text.includes("invalid_grant")) {
        return {
          ok: false,
          error:
            "CONNEXION_EXPIREE · La connexion Google Agenda a expiré ou été révoquée. Reconnecte Google dans l'admin (/admin/agents/whatsapp → Google Agenda). Pour que ça ne se reproduise plus, l'écran de consentement OAuth doit être publié « En production » (sinon Google coupe l'accès tous les 7 jours).",
        };
      }
      return { ok: false, error: `HTTP ${resp.status} · ${text.slice(0, 300)}` };
    }
    const data = (await resp.json()) as GoogleTokens;
    if (!data.access_token) return { ok: false, error: "Pas d'access_token dans la réponse" };
    return {
      ok: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? 3600,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Récupère l'e-mail associé au token (utile pour confirmer à l'utilisateur
// quel compte a été connecté).
export async function getUserEmail(accessToken: string): Promise<string | null> {
  try {
    const resp = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

// ─── Client authentifié ──────────────────────────────────────────────
// Utilisé par tous les CRUD ci-dessous. Refresh automatique à chaque
// création. Pas de cache — coût maîtrisé et zéro état.
export type AuthedClient = {
  accessToken: string;
  calendarId: string;
  timeZone: string;
};

export async function buildClient(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  calendarId?: string;
  timeZone?: string;
}): Promise<{ ok: true; client: AuthedClient } | { ok: false; error: string }> {
  const refreshed = await refreshAccessToken({
    refreshToken: input.refreshToken,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  });
  if (!refreshed.ok) return { ok: false, error: refreshed.error };
  return {
    ok: true,
    client: {
      accessToken: refreshed.accessToken,
      calendarId: input.calendarId || "primary",
      timeZone: input.timeZone || "Europe/Paris",
    },
  };
}

// ─── CRUD événements ─────────────────────────────────────────────────
async function calFetch(
  client: AuthedClient,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = `${CAL_BASE}/calendars/${encodeURIComponent(client.calendarId)}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string>),
      authorization: `Bearer ${client.accessToken}`,
      "content-type": "application/json",
    },
  });
}

export async function listEvents(
  client: AuthedClient,
  input: {
    timeMinISO: string;
    timeMaxISO: string;
    maxResults?: number;
    query?: string;
  }
): Promise<
  | { ok: true; events: CalendarEvent[] }
  | { ok: false; error: string }
> {
  const params = new URLSearchParams({
    timeMin: input.timeMinISO,
    timeMax: input.timeMaxISO,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(input.maxResults ?? 50),
    timeZone: client.timeZone,
  });
  if (input.query) params.set("q", input.query);
  try {
    const resp = await calFetch(client, `/events?${params.toString()}`);
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `HTTP ${resp.status} · ${text.slice(0, 300)}` };
    }
    const data = (await resp.json()) as { items?: CalendarEvent[] };
    return { ok: true, events: data.items ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function createEvent(
  client: AuthedClient,
  input: CreateEventInput
): Promise<
  | { ok: true; event: CalendarEvent }
  | { ok: false; error: string }
> {
  const body = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.startISO, timeZone: input.timeZone ?? client.timeZone },
    end: { dateTime: input.endISO, timeZone: input.timeZone ?? client.timeZone },
    attendees: input.attendeeEmails?.map((email) => ({ email })),
    // sendUpdates=none : par défaut on n'envoie pas d'invitations aux
    // participants — Mickael décide au cas par cas, la modification
    // reste locale à son agenda.
  };
  try {
    const resp = await calFetch(client, `/events?sendUpdates=none`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `HTTP ${resp.status} · ${text.slice(0, 300)}` };
    }
    return { ok: true, event: (await resp.json()) as CalendarEvent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateEvent(
  client: AuthedClient,
  eventId: string,
  patch: Partial<CreateEventInput>
): Promise<
  | { ok: true; event: CalendarEvent }
  | { ok: false; error: string }
> {
  const body: Record<string, unknown> = {};
  if (patch.summary !== undefined) body.summary = patch.summary;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.location !== undefined) body.location = patch.location;
  if (patch.startISO)
    body.start = { dateTime: patch.startISO, timeZone: patch.timeZone ?? client.timeZone };
  if (patch.endISO)
    body.end = { dateTime: patch.endISO, timeZone: patch.timeZone ?? client.timeZone };
  if (patch.attendeeEmails)
    body.attendees = patch.attendeeEmails.map((email) => ({ email }));

  try {
    const resp = await calFetch(client, `/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `HTTP ${resp.status} · ${text.slice(0, 300)}` };
    }
    return { ok: true, event: (await resp.json()) as CalendarEvent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteEvent(
  client: AuthedClient,
  eventId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const resp = await calFetch(client, `/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
      method: "DELETE",
    });
    if (!resp.ok && resp.status !== 410) {
      // 410 = déjà supprimé, on considère comme succès idempotent.
      const text = await resp.text();
      return { ok: false, error: `HTTP ${resp.status} · ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Recherche de créneaux libres — utile quand Mickael demande « suis-je
// libre demain à 16h ? » ou « quel créneau libre cette semaine ? ».
// Renvoie true si aucun événement ne chevauche l'intervalle demandé.
export async function isFreeSlot(
  client: AuthedClient,
  input: { startISO: string; endISO: string }
): Promise<{ ok: true; free: boolean } | { ok: false; error: string }> {
  const list = await listEvents(client, {
    timeMinISO: input.startISO,
    timeMaxISO: input.endISO,
    maxResults: 5,
  });
  if (!list.ok) return { ok: false, error: list.error };
  return {
    ok: true,
    // On ignore les « transparent » (marqués comme disponibles), et les
    // événements qui commencent exactement à la fin de la fenêtre — un
    // rdv qui commence à 16 h ne bloque pas le créneau 15 h-16 h.
    free: list.events.filter((e) => e.status !== "cancelled").length === 0,
  };
}

// ─── Création d'un événement avec Google Meet ────────────────────────
// Utilise conferenceDataVersion=1 pour que l'API alloue une nouvelle
// conférence Meet. Le lien apparaît dans la description de l'événement
// et est envoyé aux attendee_emails (s'ils sont renseignés).
export async function createEventWithMeet(
  client: AuthedClient,
  input: CreateEventInput
): Promise<
  | { ok: true; event: CalendarEvent & { hangoutLink?: string } }
  | { ok: false; error: string }
> {
  const requestId = `rp-meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const body = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.startISO, timeZone: input.timeZone ?? client.timeZone },
    end: { dateTime: input.endISO, timeZone: input.timeZone ?? client.timeZone },
    attendees: input.attendeeEmails?.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  try {
    // conferenceDataVersion=1 est OBLIGATOIRE pour que Google crée la
    // conférence. Sans ce param, la conferenceData est ignorée.
    const resp = await calFetch(
      client,
      `/events?sendUpdates=none&conferenceDataVersion=1`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `HTTP ${resp.status} · ${text.slice(0, 300)}` };
    }
    return {
      ok: true,
      event: (await resp.json()) as CalendarEvent & { hangoutLink?: string },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Recherche de N créneaux libres ────────────────────────────────
// Balaie la fenêtre demandée par pas de 15 min et sélectionne les
// créneaux qui :
//   1. sont dans les horaires ouvrés (working_hours_start → end),
//   2. tombent un jour ouvré (lundi-samedi, dimanche exclu par défaut),
//   3. évitent la pause déjeuner 12h30-14h,
//   4. ne chevauchent aucun événement existant.
// Renvoie jusqu'à `count` créneaux consécutifs disponibles.
export async function findFreeSlots(
  client: AuthedClient,
  input: {
    durationMinutes: number;
    fromISO: string;
    toISO: string;
    count?: number;
    workingHoursStart?: number; // heure 0-23
    workingHoursEnd?: number;   // heure 0-23
    includeSunday?: boolean;
    excludeLunch?: boolean;
  }
): Promise<
  | { ok: true; slots: Array<{ startISO: string; endISO: string }> }
  | { ok: false; error: string }
> {
  const count = input.count ?? 3;
  const startHour = input.workingHoursStart ?? 9;
  const endHour = input.workingHoursEnd ?? 19;
  const includeSunday = input.includeSunday ?? false;
  const excludeLunch = input.excludeLunch ?? true;
  const durationMs = input.durationMinutes * 60_000;

  // Récupère tous les événements de la fenêtre pour comparaison.
  const list = await listEvents(client, {
    timeMinISO: input.fromISO,
    timeMaxISO: input.toISO,
    maxResults: 250,
  });
  if (!list.ok) return { ok: false, error: list.error };

  // Convertit les événements en intervalles UTC ms pour comparaison.
  const busy: Array<{ start: number; end: number }> = list.events
    .filter((e) => e.status !== "cancelled")
    .map((e) => {
      const s = e.start.dateTime || e.start.date;
      const en = e.end.dateTime || e.end.date;
      return {
        start: s ? new Date(s).getTime() : 0,
        end: en ? new Date(en).getTime() : 0,
      };
    })
    .filter((b) => b.start > 0 && b.end > 0)
    .sort((a, b) => a.start - b.start);

  function overlapsBusy(startMs: number, endMs: number): boolean {
    for (const b of busy) {
      if (b.end <= startMs) continue;
      if (b.start >= endMs) break;
      return true;
    }
    return false;
  }

  const from = new Date(input.fromISO).getTime();
  const to = new Date(input.toISO).getTime();
  const STEP = 15 * 60_000; // pas de 15 min
  const slots: Array<{ startISO: string; endISO: string }> = [];

  // Curseur : arrondi au pas de 15 min suivant à partir de \`from\`.
  let cursor = Math.ceil(from / STEP) * STEP;
  while (cursor + durationMs <= to && slots.length < count) {
    const startDate = new Date(cursor);
    const endDate = new Date(cursor + durationMs);

    // Filtres calendaires (dans le fuseau horaire du client Google).
    // Note : on lit l'heure en local via toLocaleString avec le TZ.
    const local = new Date(
      startDate.toLocaleString("en-US", { timeZone: client.timeZone })
    );
    const localEnd = new Date(
      endDate.toLocaleString("en-US", { timeZone: client.timeZone })
    );
    const dayOfWeek = local.getDay(); // 0 = dimanche
    const hour = local.getHours();
    const minutes = local.getMinutes();
    const endHourVal = localEnd.getHours();
    const endMinutes = localEnd.getMinutes();

    // Dimanche exclu par défaut
    const isSunday = dayOfWeek === 0;
    if (!includeSunday && isSunday) {
      cursor += STEP;
      continue;
    }
    // Working hours
    const startsAfterOpen = hour > startHour || (hour === startHour && minutes >= 0);
    const endsBeforeClose =
      endHourVal < endHour || (endHourVal === endHour && endMinutes === 0);
    if (!startsAfterOpen || !endsBeforeClose) {
      cursor += STEP;
      continue;
    }
    // Pause déjeuner 12h30 → 14h : on refuse si le créneau chevauche.
    if (excludeLunch) {
      const lunchStart = hour * 60 + minutes;
      const lunchEnd = endHourVal * 60 + endMinutes;
      const LUNCH_S = 12 * 60 + 30;
      const LUNCH_E = 14 * 60;
      if (lunchStart < LUNCH_E && lunchEnd > LUNCH_S) {
        cursor += STEP;
        continue;
      }
    }
    // Pas de conflit calendrier
    if (overlapsBusy(cursor, cursor + durationMs)) {
      cursor += STEP;
      continue;
    }
    slots.push({
      startISO: startDate.toISOString(),
      endISO: endDate.toISOString(),
    });
    // On avance de la durée complète pour ne pas renvoyer des créneaux
    // qui se chevauchent (16h-17h + 16h15-17h15 est un doublon utile
    // pour l'algo mais pas pour l'humain).
    cursor += durationMs;
  }

  return { ok: true, slots };
}
