/**
 * Stress test exhaustif des 3 générateurs PDF.
 * Objectif : AUCUN cas ne doit lever d'exception, chaque PDF doit être
 * valide (chargeable, >= 1 page).
 */
import fs from "node:fs";
import { PDFDocument } from "pdf-lib";
import {
  buildQuotePdf,
  buildInvoicePdf,
  buildContractPdf,
  __setHeroCacheForTest,
} from "../src/lib/pdf-generator.ts";

// Charge la vraie photo hero (chemin critique : embedJpg)
const HERO =
  "https://crqsj8bzda2jtevv.public.blob.vercel-storage.com/posts/hero-1781813364572-o90lnp-DSC02398.jpg";
try {
  const r = await fetch(HERO);
  if (r.ok) {
    const buf = new Uint8Array(await r.arrayBuffer());
    __setHeroCacheForTest({ bytes: buf, type: buf[0] === 0x89 ? "png" : "jpg" });
  } else {
    __setHeroCacheForTest(null); // teste aussi le chemin sans photo
  }
} catch {
  __setHeroCacheForTest(null);
}

const studioNoVat = {
  company_legal_name: "Mickaël Romero",
  company_status: "Micro-entrepreneur",
  company_siret: "85325574300025",
  company_address: "12 rue du grand pin, 06100 Nice",
  company_email: "romerophotography.contact@gmail.com",
  company_phone: "06 04 03 70 76",
  company_iban: "FR76 3000 4000 0300 0012 3456 789",
  vat_status: "no",
};
const studioVat = { ...studioNoVat, vat_status: "yes", vat_rate: "20", vat_number: "FR12345678901" };
// Studio avec accents + caractères piégeux dans les champs libres
const studioTricky = {
  ...studioNoVat,
  company_legal_name: "Mickaël Romero — EI",
  company_address: "12 rue du Grand-Pin , 06100 Nice", // U+202F piégeux
  contract_extra_clauses: "Clause spéciale : livraison sous 6 semaines → galerie privée.",
};

const clientFull = {
  name: "Mme Hélène Millois & M. Jérémy Cossec",
  email: "helene@example.com",
  phone: "06 06 86 50 74",
  address: "567 Lieu-dit Kermargant\n56440 Languidic\nFrance",
  postal_city: "56440 Languidic",
};
const clientMinimal = { name: "Sophie & Marc" }; // email/phone/address absents

const lineRich = {
  label: "FORMULE PRESTIGE ÉTERNEL",
  detail:
    "- Préparatifs des mariés\n- Cérémonie civile et cérémonie laïque ou religieuse\n- Photos de couple et de groupe\n- Vin d'honneur\n- Ouverture de bal\n- Second photographe toute la journée\n- Album de 40 photos imprimées\n- 2 agrandissements 60 × 90 cm encadrés\n- Galerie privée en ligne\n- Retouches premium\n- Frais de déplacement 100 km inclus",
  quantity: 1,
  unit_price_cents: 499900,
};
const lineSimple = { label: "Séance d'engagement", detail: "Avant le mariage", quantity: 1, unit_price_cents: 20000 };
const lineNoDetail = { label: "Album photo premium", quantity: 2, unit_price_cents: 14900 };
const lineTricky = {
  label: "Prestation → spéciale",           // flèche piégeuse
  detail: "Ligne avec 1 234,56 € et une flèche →",
  quantity: 1,
  unit_price_cents: 123456,
};

const cases = [];
function add(name, kind, studio, doc) {
  cases.push({ name, kind, studio, doc });
}

// ── DEVIS ──
add("devis simple 1 ligne", "quote", studioNoVat, {
  reference: "DEV-2026-001", issue_date: "2026-07-23", validity_days: 60,
  client: clientFull, wedding: { date: "2027-06-12", location: "Antibes", formula_name: "Grand Classique" },
  lines: [lineSimple], deposit_pct: 30,
});
add("devis riche 5 lignes (pagination)", "quote", studioNoVat, {
  reference: "DEV-2026-002", issue_date: "2026-07-23",
  client: clientFull, wedding: { date: "2027-06-12", location: "Nice" },
  lines: [lineRich, lineSimple, lineNoDetail, lineRich, lineSimple], deposit_pct: 30,
});
add("devis TVA applicable", "quote", studioVat, {
  reference: "DEV-2026-003", issue_date: "2026-07-23",
  client: clientFull, wedding: { formula_name: "Essentielle" },
  lines: [lineSimple, lineNoDetail], deposit_pct: 40,
});
add("devis client minimal + date mariage vide", "quote", studioNoVat, {
  reference: "DEV-2026-004", issue_date: "2026-07-23",
  client: clientMinimal, wedding: { date: "", location: "", formula_name: "" },
  lines: [lineSimple], deposit_pct: 30,
});
add("devis caracteres piegeux (U+202F, fleche)", "quote", studioTricky, {
  reference: "DEV-2026-005", issue_date: "2026-07-23",
  client: clientFull, wedding: { date: "2027-06-12", location: "Nice " },
  lines: [lineTricky, lineRich], deposit_pct: 30,
});
add("devis sans deposit_pct ni validity", "quote", studioNoVat, {
  reference: "DEV-2026-006", issue_date: "2026-07-23",
  client: clientFull, wedding: {}, lines: [lineSimple],
});
add("devis 10 lignes (multi-pages)", "quote", studioNoVat, {
  reference: "DEV-2026-007", issue_date: "2026-07-23",
  client: clientFull, wedding: {}, lines: Array(10).fill(lineRich), deposit_pct: 30,
});

// ── FACTURE ──
add("facture avec acompte verse", "invoice", studioNoVat, {
  reference: "FA-2026-001", issue_date: "2026-07-23", due_date: "2026-08-23",
  client: clientFull, wedding: { date: "2027-06-12" }, lines: [lineRich],
  payment_terms: "Paiement à réception, par virement.", already_paid_cents: 149970,
});
add("facture TVA + due_date vide", "invoice", studioVat, {
  reference: "FA-2026-002", issue_date: "2026-07-23", due_date: "",
  client: clientMinimal, wedding: {}, lines: [lineSimple, lineNoDetail], already_paid_cents: 0,
});
add("facture sans IBAN", "invoice", { ...studioNoVat, company_iban: "" }, {
  reference: "FA-2026-003", issue_date: "2026-07-23",
  client: clientFull, wedding: {}, lines: [lineRich, lineSimple, lineNoDetail],
});

// ── CONTRAT ──
add("contrat complet", "contract", studioNoVat, {
  reference: "CT-2026-001", issue_date: "2026-07-23",
  client: clientFull,
  wedding: { date: "2027-06-12", location: "Villa Belrose", guest_count: 120,
    prep_location: "Domicile", ceremony_location: "Mairie de Nice", reception_location: "Villa Belrose" },
  formula_name: "Grand Classique", formula_description: "Couverture complète",
  options: "Second shooter, album", price_cents: 249900, deposit_pct: 30,
});
add("contrat date vide (bug precedent)", "contract", studioNoVat, {
  reference: "CT-2026-002", issue_date: "2026-07-23",
  client: clientMinimal,
  wedding: { date: "", location: "", guest_count: 0 },
  formula_name: "Le Grand Classique", formula_description: "",
  price_cents: 249900, deposit_pct: 30,
});
add("contrat clauses additionnelles + accents", "contract", studioTricky, {
  reference: "CT-2026-003", issue_date: "2026-07-23",
  client: clientFull,
  wedding: { date: "2027-06-12", location: "Èze" },
  formula_name: "Prestige Éternel", formula_description: "La formule luxe",
  options: "", price_cents: 499900, deposit_pct: 40,
  cancellation_policy: "Annulation à plus de 90 jours : acompte conservé.",
});

// ── Exécution ──
let ok = 0, fail = 0;
for (const c of cases) {
  try {
    const fn = c.kind === "quote" ? buildQuotePdf : c.kind === "invoice" ? buildInvoicePdf : buildContractPdf;
    const bytes = await fn({ studio: c.studio, doc: c.doc });
    const pdf = await PDFDocument.load(bytes);
    const pages = pdf.getPageCount();
    if (pages < 1 || bytes.length < 1000) throw new Error(`PDF suspect (${pages}p, ${bytes.length}o)`);
    console.log(`  ✓ ${c.name.padEnd(48)} ${pages}p ${(bytes.length/1024).toFixed(0)}Ko`);
    ok++;
  } catch (e) {
    console.log(`  ✗ ${c.name.padEnd(48)} ERREUR: ${e.message}`);
    fail++;
  }
}
console.log(`\n${ok}/${cases.length} OK` + (fail ? `  —  ${fail} ECHEC(S)` : "  —  tout passe"));
process.exit(fail ? 1 : 0);
