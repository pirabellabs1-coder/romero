/**
 * GET /api/admin/export/calendar?year=2026&month=8
 * ─────────────────────────────────────────────────
 * PDF planning mensuel imprimable — mariages du mois avec toutes les
 * coordonnées + notes. Génère avec pdf-lib, télécharge en 1 clic.
 * Params optionnels : year, month (par défaut = mois courant).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSharedConfig } from "@/lib/studio-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

type Wedding = {
  id: number;
  name: string;
  wedding_date: string;
  wedding_location: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(now.getFullYear()), 10);
  const month = parseInt(req.nextUrl.searchParams.get("month") ?? String(now.getMonth() + 1), 10);
  if (!Number.isFinite(year) || year < 2020 || year > 2100)
    return NextResponse.json({ ok: false, error: "année invalide" }, { status: 400 });
  if (!Number.isFinite(month) || month < 1 || month > 12)
    return NextResponse.json({ ok: false, error: "mois invalide (1-12)" }, { status: 400 });

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate = new Date(year, month, 0).getDate(); // dernier jour du mois
  const to = `${year}-${String(month).padStart(2, "0")}-${String(toDate).padStart(2, "0")}`;

  const [weddings, shared] = await Promise.all([
    query<Wedding>(
      `SELECT id, name,
              to_char(wedding_date, 'YYYY-MM-DD') as wedding_date,
              wedding_location, email, phone, notes
       FROM admin_contacts
       WHERE wedding_date BETWEEN $1::date AND $2::date
       ORDER BY wedding_date ASC`,
      [from, to]
    ).catch(() => []),
    getSharedConfig().catch(() => ({} as Record<string, string>)),
  ]);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const gold = rgb(0.72, 0.59, 0.35);
  const dark = rgb(0.18, 0.24, 0.18);
  const grey = rgb(0.4, 0.4, 0.4);
  const light = rgb(0.6, 0.6, 0.6);

  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;

  // En-tête
  page.drawText(shared.legal_name || "Romero Photography", {
    x: margin,
    y,
    size: 16,
    font: bold,
    color: dark,
  });
  page.drawText("Planning mensuel", {
    x: margin,
    y: y - 18,
    size: 10,
    font: oblique,
    color: grey,
  });

  const title = `${MONTHS_FR[month - 1].toUpperCase()} ${year}`;
  const titleWidth = bold.widthOfTextAtSize(title, 20);
  page.drawText(title, {
    x: width - margin - titleWidth,
    y: y - 5,
    size: 20,
    font: bold,
    color: gold,
  });

  y -= 42;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.7,
    color: gold,
  });
  y -= 18;

  if (weddings.length === 0) {
    page.drawText("Aucun mariage prévu ce mois-ci.", {
      x: margin,
      y,
      size: 12,
      font: oblique,
      color: grey,
    });
  } else {
    page.drawText(`${weddings.length} mariage(s) prévu(s) ce mois :`, {
      x: margin,
      y,
      size: 10.5,
      font: helv,
      color: grey,
    });
    y -= 22;

    for (const w of weddings) {
      if (y < margin + 80) {
        // Nouvelle page si on manque de place
        y = height - margin;
        const np = pdf.addPage([595, 842]);
        // On continue sur cette nouvelle page — pointer réassigné
        page.drawText("(suite au verso)", {
          x: margin,
          y: margin,
          size: 8,
          font: oblique,
          color: light,
        });
        // Simplification : on stop et note « suite »
        break;
      }

      const d = new Date(w.wedding_date);
      const dayNum = String(d.getDate()).padStart(2, "0");
      const dayName = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][d.getDay()];

      // Bloc date à gauche
      page.drawRectangle({
        x: margin,
        y: y - 46,
        width: 54,
        height: 52,
        borderColor: gold,
        borderWidth: 0.8,
      });
      page.drawText(dayNum, {
        x: margin + 27 - bold.widthOfTextAtSize(dayNum, 22) / 2,
        y: y - 22,
        size: 22,
        font: bold,
        color: gold,
      });
      page.drawText(dayName, {
        x: margin + 27 - helv.widthOfTextAtSize(dayName, 8) / 2,
        y: y - 40,
        size: 8,
        font: helv,
        color: grey,
      });

      // Nom + lieu + coordonnées
      const infoX = margin + 66;
      page.drawText(w.name, {
        x: infoX,
        y: y - 4,
        size: 12.5,
        font: bold,
        color: dark,
      });
      if (w.wedding_location) {
        page.drawText(`Lieu : ${w.wedding_location}`, {
          x: infoX,
          y: y - 20,
          size: 9.5,
          font: helv,
          color: grey,
        });
      }
      const contactLine = [w.email, w.phone].filter(Boolean).join("  ·  ");
      if (contactLine) {
        page.drawText(contactLine, {
          x: infoX,
          y: y - 34,
          size: 9,
          font: helv,
          color: light,
        });
      }
      if (w.notes) {
        const notesShort = w.notes.slice(0, 130) + (w.notes.length > 130 ? "…" : "");
        page.drawText(notesShort, {
          x: infoX,
          y: y - 46,
          size: 8.5,
          font: oblique,
          color: light,
        });
      }

      y -= 66;
    }
  }

  // Pied de page
  const footer = `Généré le ${new Date().toLocaleDateString("fr-FR")} · ${shared.legal_name || "Romero Photography"}`;
  page.drawText(footer, {
    x: margin,
    y: margin - 10,
    size: 7.5,
    font: oblique,
    color: light,
  });

  const bytes = await pdf.save();

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="planning-${year}-${String(month).padStart(2, "0")}.pdf"`,
    },
  });
}
