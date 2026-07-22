/**
 * Booking : orchestration RDV cross-agent
 * ────────────────────────────────────────
 * Une seule fonction qui prend un slot + un prospect, crée l'événement
 * Google Calendar avec Meet, envoie l'email de confirmation au prospect,
 * et pousse une notif Telegram/WhatsApp à Mickael.
 *
 * Utilisé par :
 *   - Chatbot site (tool `book_appointment` dans /api/chat/route.ts)
 *   - Assistant Telegram (après create_event_with_meet dans whatsapp-assistant.ts)
 *
 * DRY : évite deux logiques de confirmation qui divergeraient.
 */
import { getAgent } from "@/lib/agents";
import { buildClient, createEventWithMeet } from "@/lib/google-calendar";
import { sendMail } from "@/lib/mailer";
import { notifyMickael } from "@/lib/whatsapp-notify";

export type BookingInput = {
  /** Prénom + nom (ou juste prénom) */
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  /** Sujet court, ex "Séance engagement" ou "Discussion mariage août 2026" */
  topic: string;
  /** ISO 8601 avec timezone, ex "2026-08-05T15:00:00+02:00" */
  startISO: string;
  /** Durée en minutes */
  durationMin: number;
  /** Contexte libre pour Mickael (résumé de la conv, budget, lieu…) */
  briefingForMickael?: string;
  /** Source du booking, pour la notif */
  source: "chatbot" | "telegram" | "whatsapp";
};

export type BookingResult =
  | {
      ok: true;
      eventId: string;
      meetLink?: string;
      htmlLink?: string;
    }
  | { ok: false; error: string };

function fmtHumanDate(iso: string, timeZone = "Europe/Paris"): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function bookAppointment(input: BookingInput): Promise<BookingResult> {
  // 1. Config Google via agent whatsapp (source unique des creds calendrier)
  const wa = await getAgent("whatsapp").catch(() => null);
  const cfg = (wa?.config ?? {}) as {
    google_client_id?: string;
    google_client_secret?: string;
    google_refresh_token?: string;
    google_calendar_id?: string;
    google_timezone?: string;
  };
  if (!cfg.google_client_id || !cfg.google_client_secret || !cfg.google_refresh_token) {
    return { ok: false, error: "Google Agenda non connecté côté studio" };
  }

  const timeZone = cfg.google_timezone || "Europe/Paris";
  const clientRes = await buildClient({
    refreshToken: cfg.google_refresh_token,
    clientId: cfg.google_client_id,
    clientSecret: cfg.google_client_secret,
    calendarId: cfg.google_calendar_id,
    timeZone,
  });
  if (!clientRes.ok) return { ok: false, error: `Google auth : ${clientRes.error}` };

  // 2. Bornes de l'événement
  const startMs = new Date(input.startISO).getTime();
  if (Number.isNaN(startMs))
    return { ok: false, error: `startISO invalide : ${input.startISO}` };
  const endISO = new Date(startMs + input.durationMin * 60_000).toISOString();

  // 3. Crée l'événement avec Meet + attendee prospect
  const description = [
    `Prospect : ${input.contactName}`,
    input.contactEmail ? `Email : ${input.contactEmail}` : null,
    input.contactPhone ? `Téléphone : ${input.contactPhone}` : null,
    "",
    input.briefingForMickael || "(pas de résumé complémentaire)",
    "",
    `Source : ${input.source}`,
  ]
    .filter(Boolean)
    .join("\n");

  const evtRes = await createEventWithMeet(clientRes.client, {
    summary: `RDV visio — ${input.contactName} · ${input.topic}`,
    description,
    startISO: input.startISO,
    endISO,
    attendeeEmails: [input.contactEmail],
    timeZone,
  });
  if (!evtRes.ok) return { ok: false, error: `Google Calendar : ${evtRes.error}` };

  const meetLink = evtRes.event.hangoutLink;
  const humanDate = fmtHumanDate(input.startISO, timeZone);

  // 4. Email confirmation au prospect (best-effort, on ne bloque pas si ça échoue)
  try {
    const emailText = `Bonjour ${input.contactName.split(" ")[0]},

C'est confirmé : notre échange visio est calé pour ${humanDate} (durée : ${input.durationMin} min).

${meetLink ? `Lien Google Meet :\n${meetLink}\n\n` : ""}Je te rappellerai les questions à préparer dans un prochain message si besoin.

Sujet : ${input.topic}

À très vite,
Mickael Romero
Romero Photography
https://romerophotography.fr`;

    await sendMail({
      to: input.contactEmail,
      subject: `Confirmation RDV — ${humanDate}`,
      text: emailText,
      replyTo: "romerophotography.contact@gmail.com",
    });
  } catch (e) {
    console.warn("[booking] email prospect a échoué (non bloquant) :", e);
  }

  // 5. Notif Mickael (best-effort aussi)
  try {
    const notifText = `📅 Nouveau RDV pris (${input.source})

${humanDate}
${input.contactName}${input.contactPhone ? ` · ${input.contactPhone}` : ""}
${input.contactEmail}

Sujet : ${input.topic}
${input.briefingForMickael ? `\n${input.briefingForMickael}` : ""}
${meetLink ? `\nMeet : ${meetLink}` : ""}`;
    await notifyMickael(notifText);
  } catch (e) {
    console.warn("[booking] notif Mickael a échoué (non bloquant) :", e);
  }

  return {
    ok: true,
    eventId: evtRes.event.id ?? "",
    meetLink,
    htmlLink: evtRes.event.htmlLink,
  };
}
