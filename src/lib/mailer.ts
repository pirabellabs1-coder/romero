import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";
import { getSettings } from "@/lib/settings";

/* ──────────────────────────────────────────────────────────────────────────
   Providers — Resend primary, SMTP fallback
   ────────────────────────────────────────────────────────────────────────── */

let _resend: Resend | null | undefined;
function getResend(): Resend | null {
  if (_resend !== undefined) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    _resend = null;
    return null;
  }
  _resend = new Resend(key);
  return _resend;
}

let _transporter: Transporter | null | undefined;
function getSmtp(): Transporter | null {
  if (_transporter !== undefined) return _transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    _transporter = null;
    return null;
  }
  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return _transporter;
}

/* ──────────────────────────────────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────────────────────────────────── */

export type ContactMail = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  weddingDate?: string;
  place?: string;
  message: string;
  lang: string;
};

export type SendResult = {
  sent: boolean;
  provider?: "resend" | "smtp";
  id?: string;
  error?: string;
};

export async function sendContactNotification(data: ContactMail): Promise<SendResult> {
  const settings = await getSettings();
  const to = (process.env.MAIL_TO || settings.contact_email || "").trim();
  const from = (process.env.MAIL_FROM || "Romero Photography <onboarding@resend.dev>").trim();
  const replyTo = `${data.firstName} ${data.lastName} <${data.email}>`;
  const subject = `Nouvelle demande — ${data.firstName} ${data.lastName}${data.place ? ` · ${data.place}` : ""}`;
  if (!to) return { sent: false, error: "no_recipient" };

  const html = renderContactHtml(data, { siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://romerophotography.fr" });
  const text = renderContactText(data);

  // 1. Try Resend
  const resend = getResend();
  if (resend) {
    try {
      const { data: res, error } = await resend.emails.send({
        from,
        to: [to],
        replyTo,
        subject,
        html,
        text,
      });
      if (error) throw new Error(error.message || "resend_error");
      return { sent: true, provider: "resend", id: res?.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "resend_error";
      console.error("[mailer] Resend failed:", msg, "— falling back to SMTP if configured.");
      // fall through to SMTP
    }
  }

  // 2. SMTP fallback
  const transporter = getSmtp();
  if (transporter) {
    try {
      const info = await transporter.sendMail({ from, to, replyTo, subject, html, text });
      return { sent: true, provider: "smtp", id: info.messageId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "smtp_error";
      console.error("[mailer] SMTP failed:", msg);
      return { sent: false, error: msg };
    }
  }

  console.warn("[mailer] No provider configured. Set RESEND_API_KEY in .env.local. Email skipped (message still saved to DB).");
  return { sent: false, error: "no_provider" };
}

/** Public helper so an admin preview route can render the template visually. */
export function renderContactEmailHtml(data: ContactMail): string {
  return renderContactHtml(data, { siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000" });
}

/**
 * Envoi générique — utilisé par le flow de validation Telegram pour
 * envoyer la réponse approuvée au client. Resend → SMTP fallback.
 */
export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}): Promise<SendResult> {
  const from = (process.env.MAIL_FROM || "Romero Photography <onboarding@resend.dev>").trim();
  const to = input.to.trim();
  if (!to) return { sent: false, error: "no_recipient" };

  // Wrap texte en HTML minimal si non fourni
  const html =
    input.html ??
    `<div style="font-family:system-ui,sans-serif;color:#2E3D2E;line-height:1.6;font-size:15px;max-width:600px">${input.text
      .split("\n")
      .map((l) => `<p style="margin:0 0 12px">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
      .join("")}</div>`;

  // On garde la dernière erreur pour ne PAS la masquer derrière
  // « no_provider » quand un provider existe mais échoue (ex : format
  // de pièce jointe invalide).
  let lastError: string | null = null;

  // 1. Resend
  const resend = getResend();
  if (resend) {
    try {
      const { data: res, error } = await resend.emails.send({
        from,
        to: [to],
        replyTo: input.replyTo,
        subject: input.subject,
        text: input.text,
        html,
        // Resend SDK attend content en Buffer (ou base64 string). On passe
        // le Buffer directement — c'est le plus fiable.
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.isBuffer(a.content)
            ? a.content
            : Buffer.from(String(a.content)),
          contentType: a.contentType,
        })),
      });
      if (error) throw new Error(error.message || "resend_error");
      return { sent: true, provider: "resend", id: res?.id };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "resend_error";
      console.error("[mailer.sendMail] Resend failed:", lastError);
      // fall through to SMTP if configured
    }
  }

  // 2. SMTP
  const transporter = getSmtp();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        replyTo: input.replyTo,
        subject: input.subject,
        text: input.text,
        html,
        attachments: input.attachments,
      });
      return { sent: true, provider: "smtp", id: info.messageId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "smtp_error";
      return { sent: false, error: msg };
    }
  }

  // Si Resend existait mais a échoué, on remonte SA vraie erreur plutôt
  // que le trompeur « no_provider ».
  return { sent: false, error: lastError ?? "no_provider" };
}

/* ──────────────────────────────────────────────────────────────────────────
   Lead notification (from the site chatbot)
   Utilisée par /api/chat quand l'agent appelle send_lead_notification.
   ────────────────────────────────────────────────────────────────────────── */

export type LeadMail = {
  subject: string;
  html: string;
  text: string;
  replyToEmail?: string;
  replyToName?: string;
};

export async function sendLeadNotification(mail: LeadMail): Promise<SendResult> {
  const settings = await getSettings();
  const to = (process.env.MAIL_TO || settings.contact_email || "").trim();
  const from = (process.env.MAIL_FROM || "Romero Photography <onboarding@resend.dev>").trim();
  if (!to) return { sent: false, error: "no_recipient" };
  const replyTo =
    mail.replyToEmail && mail.replyToName
      ? `${mail.replyToName} <${mail.replyToEmail}>`
      : mail.replyToEmail || undefined;

  const resend = getResend();
  if (resend) {
    try {
      const { data: res, error } = await resend.emails.send({
        from,
        to: [to],
        replyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      if (error) throw new Error(error.message || "resend_error");
      return { sent: true, provider: "resend", id: res?.id };
    } catch (e) {
      console.error(
        "[mailer/lead] Resend failed:",
        e instanceof Error ? e.message : e,
        "— falling back to SMTP if configured."
      );
    }
  }

  const transporter = getSmtp();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        replyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      return { sent: true, provider: "smtp", id: info.messageId };
    } catch (e) {
      return { sent: false, error: e instanceof Error ? e.message : "smtp_error" };
    }
  }

  return { sent: false, error: "no_provider" };
}

/* ──────────────────────────────────────────────────────────────────────────
   Templates
   ────────────────────────────────────────────────────────────────────────── */

function renderContactText(d: ContactMail): string {
  return [
    `Nouvelle demande reçue depuis le site Romero Photography.`,
    ``,
    `Prénom: ${d.firstName}`,
    `Nom: ${d.lastName}`,
    `Email: ${d.email}`,
    `Téléphone: ${d.phone || "—"}`,
    `Date du mariage: ${d.weddingDate || "—"}`,
    `Lieu pressenti: ${d.place || "—"}`,
    `Langue: ${d.lang.toUpperCase()}`,
    ``,
    `Message:`,
    d.message,
    ``,
    `— Répondez directement à cet e-mail pour contacter ${d.firstName}.`,
  ].join("\n");
}

function renderContactHtml(d: ContactMail, ctx: { siteUrl: string }): string {
  const rows: [string, string, string?][] = [
    ["Prénom & Nom", `${d.firstName} ${d.lastName}`],
    ["Email", d.email, `mailto:${d.email}`],
    ["Téléphone", d.phone || "—", d.phone ? `tel:${d.phone.replace(/\s+/g, "")}` : undefined],
    ["Date du mariage", d.weddingDate || "—"],
    ["Lieu pressenti", d.place || "—"],
    ["Langue", d.lang.toUpperCase()],
  ];

  // All styles inline for maximum email-client compatibility (Gmail, Outlook, Apple Mail)
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Nouvelle demande Romero Photography</title>
</head>
<body style="margin:0;padding:0;background:#F8F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#2A2520;">
  <span style="display:none;font-size:1px;color:#F8F4EC;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Nouvelle demande de ${escapeHtml(d.firstName)} ${escapeHtml(d.lastName)}${d.place ? ` — ${escapeHtml(d.place)}` : ""}
  </span>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F8F4EC;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="max-width:620px;width:100%;background:#FFFFFF;border:1px solid rgba(184,151,90,0.25);border-radius:8px;overflow:hidden;box-shadow:0 4px 18px rgba(46,61,46,0.06);">

        <!-- Header band: forest green with gold monogram -->
        <tr><td style="background:#2E3D2E;padding:34px 30px 28px;text-align:center;">
          <div style="display:inline-block;border:1px solid #D4B97A;padding:14px 20px;border-radius:2px;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;color:#D4B97A;letter-spacing:0.12em;line-height:1;">RP</div>
          </div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#F4EFE3;letter-spacing:0.32em;margin-top:18px;">ROMERO</div>
          <div style="font-size:9px;letter-spacing:0.32em;color:#D4B97A;margin-top:6px;">PHOTOGRAPHY</div>
        </td></tr>

        <!-- Eyebrow + Headline -->
        <tr><td style="padding:34px 36px 6px;">
          <div style="font-size:10px;letter-spacing:0.32em;text-transform:uppercase;color:#B8975A;margin-bottom:14px;">Nouvelle demande</div>
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.2;color:#2E3D2E;letter-spacing:0.01em;">
            ${escapeHtml(d.firstName)} ${escapeHtml(d.lastName)}<br>
            <span style="color:#B8975A;font-style:italic;font-size:18px;">souhaite échanger avec vous</span>
          </h1>
          <!-- Gold divider -->
          <div style="margin:18px 0 4px;display:flex;align-items:center;justify-content:flex-start;">
            <span style="display:inline-block;width:48px;height:1px;background:#B8975A;opacity:0.55;vertical-align:middle;"></span>
            <span style="display:inline-block;width:6px;height:6px;background:#B8975A;transform:rotate(45deg);margin:0 10px;vertical-align:middle;"></span>
            <span style="display:inline-block;width:48px;height:1px;background:#B8975A;opacity:0.55;vertical-align:middle;"></span>
          </div>
        </td></tr>

        <!-- Details table -->
        <tr><td style="padding:18px 36px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-size:14px;">
            ${rows
              .map(([k, v, href]) => `
              <tr>
                <td style="padding:11px 0;color:#7A7066;width:170px;border-bottom:1px solid rgba(184,151,90,0.15);font-size:11px;letter-spacing:0.18em;text-transform:uppercase;vertical-align:top;">${escapeHtml(k)}</td>
                <td style="padding:11px 0;color:#2A2520;border-bottom:1px solid rgba(184,151,90,0.15);font-size:15px;font-weight:500;">
                  ${href ? `<a href="${escapeHtmlAttr(href)}" style="color:#B8975A;text-decoration:none;">${escapeHtml(v)}</a>` : escapeHtml(v)}
                </td>
              </tr>`)
              .join("")}
          </table>
        </td></tr>

        <!-- Message block -->
        <tr><td style="padding:24px 36px 8px;">
          <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#7A7066;margin-bottom:10px;">Le message</div>
          <div style="background:#F8F4EC;border-left:3px solid #B8975A;padding:20px 24px;border-radius:0 4px 4px 0;line-height:1.7;color:#2A2520;white-space:pre-wrap;font-size:15px;font-style:italic;">${escapeHtml(d.message)}</div>
        </td></tr>

        <!-- CTA reply button -->
        <tr><td style="padding:28px 36px 8px;text-align:center;">
          <a href="mailto:${escapeHtmlAttr(d.email)}?subject=${encodeURIComponent("Romero Photography — Votre demande")}" style="display:inline-block;background:#2E3D2E;color:#F4EFE3;text-decoration:none;padding:14px 30px;border-radius:4px;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;font-weight:500;">
            Répondre à ${escapeHtml(d.firstName)}
          </a>
          <div style="font-size:11px;color:#9B948A;margin-top:14px;letter-spacing:0.04em;">Ou simplement répondez à cet e-mail — ça lui arrivera directement.</div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F0E8D8;padding:22px 36px;border-top:1px solid rgba(184,151,90,0.2);text-align:center;">
          <div style="font-size:11px;color:#7A7066;letter-spacing:0.06em;">
            Reçue depuis <a href="${escapeHtmlAttr(ctx.siteUrl)}" style="color:#B8975A;text-decoration:none;">${escapeHtml(ctx.siteUrl.replace(/^https?:\/\//, ""))}</a>
          </div>
          <div style="font-size:10px;color:#9B948A;margin-top:8px;letter-spacing:0.14em;">
            ROMERO PHOTOGRAPHY · NICE · CÔTE D&apos;AZUR
          </div>
        </td></tr>

      </table>

      <div style="font-size:10px;color:#9B948A;margin-top:18px;letter-spacing:0.1em;">
        Notification automatique du site — ne pas répondre à no-reply
      </div>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeHtmlAttr(s: string): string {
  return escapeHtml(s);
}
