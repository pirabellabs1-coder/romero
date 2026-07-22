import fs from "node:fs";
import {
  buildQuotePdf,
  buildInvoicePdf,
  buildContractPdf,
  __setHeroCacheForTest,
} from "../src/lib/pdf-generator.ts";

// En local, fetchHeroImage() ne peut pas lire la DB (alias @ non résolu
// hors Next). On injecte directement l'URL hero de prod pour valider le
// rendu visuel.
const HERO_URL =
  "https://crqsj8bzda2jtevv.public.blob.vercel-storage.com/posts/hero-1781813364572-o90lnp-DSC02398.jpg";
try {
  const r = await fetch(HERO_URL);
  if (r.ok) {
    const buf = new Uint8Array(await r.arrayBuffer());
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    __setHeroCacheForTest({ bytes: buf, type: isPng ? "png" : "jpg" });
    console.log(`hero chargee : ${buf.length} octets (${isPng ? "png" : "jpg"})`);
  } else {
    console.log("hero HTTP", r.status);
  }
} catch (e) {
  console.log("hero fetch echoue :", e.message);
}

const studio = {
  company_legal_name: "Mickael Romero",
  company_status: "Micro-entrepreneur",
  company_siret: "85325574300025",
  company_rcs: "Nice",
  company_address: "12 rue du grand pin, 06100 Nice",
  company_email: "romerophotography.contact@gmail.com",
  company_phone: "06 04 03 70 76",
  company_iban: "FR76 3000 4000 0300 0012 3456 789",
  vat_status: "no",
};

const quote = {
  reference: "DEV-2026-047",
  issue_date: "2026-07-03",
  validity_days: 60,
  client: {
    name: "Mme Helene Millois & M. Jeremy Cossec",
    address: "567 Lieu-dit Kermargant\n56440 Languidic\nFrance",
    phone: "06 06 86 50 74",
    email: "helene.millois@example.com",
  },
  wedding: {
    date: "2027-10-23",
    location: "Domaine de Kermargant",
    guest_count: 120,
    formula_name: "Le Grand Classique",
  },
  lines: [
    {
      label: "FORMULE 3\nLE GRAND CLASSIQUE",
      detail:
        "- Presence le samedi de la fin des preparatifs des maries jusqu'a l'ouverture de bal\n- Ceremonie religieuse ou laique\n- Photos de couple & photos de groupe\n- Vin d'honneur\n- Ouverture de bal\n- Galerie privee en ligne\n- Retouches premium\n- Frais de deplacement inclus (jusqu'a 100 km)",
      quantity: 1,
      unit_price_cents: 224900,
    },
    {
      label: "SEANCE D'ENGAGEMENT\n+ REPORTAGE MAIRIE",
      detail:
        "- Seance d'engagement avant la mairie (le jeudi)\n- Reportage de la mairie (environ 1 heure)",
      quantity: 1,
      unit_price_cents: 20000,
    },
  ],
  deposit_pct: 30,
  notes: "",
};

const invoice = {
  ...quote,
  reference: "FA-2026-012",
  due_date: "2026-08-15",
  payment_terms: "Paiement a reception de facture, par virement bancaire.",
  already_paid_cents: 73500,
};

const contract = {
  reference: "CT-2026-008",
  issue_date: "2026-07-03",
  client: quote.client,
  wedding: {
    date: "2027-10-23",
    location: "Domaine de Kermargant",
    guest_count: 120,
    ceremony_time: "15:00",
    end_time: "02:00",
  },
  formula_name: "Le Grand Classique",
  formula_description:
    "Preparation des maries, ceremonie civile (mairie), photos de couple et de groupe, ceremonie laique ou religieuse, vin d'honneur, ouverture de bal, galerie privee en ligne, retouches premium, frais de deplacement 70 km inclus.",
  price_cents: 244900,
  deposit_pct: 30,
};

fs.writeFileSync("v2-devis.pdf", await buildQuotePdf({ studio, doc: quote }));
console.log("OK devis");
fs.writeFileSync("v2-facture.pdf", await buildInvoicePdf({ studio, doc: invoice }));
console.log("OK facture");
fs.writeFileSync("v2-contrat.pdf", await buildContractPdf({ studio, doc: contract }));
console.log("OK contrat");
