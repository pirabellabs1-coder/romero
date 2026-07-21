/**
 * GET /api/admin/export/contacts?format=csv|vcard
 * ───────────────────────────────────────────────
 * Télécharge la liste des contacts CRM de Mickael au format CSV
 * (importable Excel / Google Sheets) ou vCard (importable téléphone).
 * Idéal pour backup + intégration avec ses outils habituels.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contact = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  wedding_date: string | null;
  wedding_location: string | null;
  notes: string | null;
  document_count: number;
  last_document_at: string | null;
  total_billed_cents: number;
  created_at: string;
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n"))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Contact[]): string {
  const headers = [
    "id",
    "nom",
    "email",
    "telephone",
    "adresse",
    "date_mariage",
    "lieu_mariage",
    "notes",
    "nombre_docs",
    "dernier_doc",
    "total_facture_eur",
    "cree_le",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.name,
        r.email,
        r.phone,
        r.address,
        r.wedding_date,
        r.wedding_location,
        r.notes,
        r.document_count,
        r.last_document_at,
        (r.total_billed_cents / 100).toFixed(2),
        r.created_at,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\n");
}

function toVCard(rows: Contact[]): string {
  const out: string[] = [];
  for (const r of rows) {
    const lines = ["BEGIN:VCARD", "VERSION:3.0"];
    lines.push(`FN:${r.name}`);
    if (r.email) lines.push(`EMAIL;TYPE=INTERNET:${r.email}`);
    if (r.phone) lines.push(`TEL;TYPE=CELL:${r.phone}`);
    if (r.address)
      lines.push(`ADR;TYPE=HOME:;;${r.address.replace(/\n/g, ", ")};;;;`);
    const noteParts: string[] = [];
    if (r.wedding_date) noteParts.push(`Mariage : ${r.wedding_date}`);
    if (r.wedding_location) noteParts.push(`Lieu : ${r.wedding_location}`);
    if (r.notes) noteParts.push(r.notes);
    if (noteParts.length > 0)
      lines.push(`NOTE:${noteParts.join(" · ").replace(/\n/g, " ")}`);
    lines.push("END:VCARD");
    out.push(lines.join("\r\n"));
  }
  return out.join("\r\n");
}

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const format = (req.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
  const rows = await query<Contact>(
    `SELECT id, name, email, phone, address,
            to_char(wedding_date, 'YYYY-MM-DD') as wedding_date,
            wedding_location, notes, document_count,
            to_char(last_document_at, 'YYYY-MM-DD"T"HH24:MI:SS') as last_document_at,
            COALESCE(total_billed_cents, 0)::bigint as total_billed_cents,
            to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at
     FROM admin_contacts
     ORDER BY name ASC`
  ).catch(() => []);

  const today = new Date().toISOString().slice(0, 10);

  if (format === "vcard" || format === "vcf") {
    return new NextResponse(toVCard(rows), {
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `attachment; filename="contacts-romero-${today}.vcf"`,
      },
    });
  }

  // Default : CSV
  const csv = "﻿" + toCsv(rows); // BOM UTF-8 pour Excel
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contacts-romero-${today}.csv"`,
    },
  });
}
