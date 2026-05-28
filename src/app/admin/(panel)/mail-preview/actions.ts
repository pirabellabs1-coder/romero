"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sendContactNotification, type ContactMail } from "@/lib/mailer";
import { queryOne } from "@/lib/db";

const FAKE: ContactMail = {
  firstName: "Camille",
  lastName: "Dupont (TEST)",
  email: "camille.dupont@example.com",
  phone: "06 12 34 56 78",
  weddingDate: "2026-08-15",
  place: "Villa Ephrussi de Rothschild, Cap Ferrat",
  message:
    "Ceci est un e-mail de TEST envoyé depuis l'interface d'administration de Romero Photography pour vérifier la configuration du système d'envoi.\n\nSi vous lisez ce message dans votre boîte, tout fonctionne correctement.\n\n— Camille & Antoine",
  lang: "fr",
};

export async function sendTestEmail(formData: FormData) {
  requireUser();
  const source = String(formData.get("source") || "fake");

  let data = FAKE;
  if (source === "latest") {
    const row = await queryOne<{
      first_name: string; last_name: string; email: string; phone: string;
      wedding_date: string; place: string; message: string; lang: string;
    }>("SELECT * FROM messages ORDER BY id DESC LIMIT 1");
    if (row) {
      data = {
        firstName: row.first_name,
        lastName: row.last_name + " (TEST)",
        email: row.email,
        phone: row.phone,
        weddingDate: row.wedding_date,
        place: row.place,
        message: row.message,
        lang: row.lang,
      };
    }
  }

  const result = await sendContactNotification(data);
  if (result.sent) {
    redirect("/admin/mail-preview?sent=1");
  } else {
    redirect(`/admin/mail-preview?error=${encodeURIComponent(result.error ?? "unknown")}`);
  }
}
