import fs from "node:fs";

const p = "src/lib/pdf-generator.ts";
const s = fs.readFileSync(p, "utf8");
const marker = "// ─── CONTRAT ─";
const idx = s.indexOf(marker);
if (idx < 0) throw new Error("marker CONTRAT not found");

const head = s.slice(0, idx);

const contract = `// ─── CONTRAT ─────────────────────────────────────────────────────────
// Structure alignée sur le contrat de référence Romero Photography :
//   En-tête + Entre les soussignés + Le Photographe + Les Clients
//   + Informations mariage + 9 articles + cases droit à l'image
//   + Fait à / Le / signatures.
// Les champs non renseignés apparaissent en pointillés à remplir main.

/** Ligne « Label : valeur » ou « Label : ______ » si vide. */
function drawFieldLine(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string | undefined,
  x: number,
  y: number,
  lineW = 200
): void {
  page.drawText(\`\${label} :\`, { x, y, size: 9, font: fonts.regular, color: INK });
  const labelW = fonts.regular.widthOfTextAtSize(sanitizeForPdf(\`\${label} :\`), 9);
  const vx = x + labelW + 6;
  if (value && value.trim()) {
    page.drawText(value.trim(), { x: vx, y, size: 9, font: fonts.bold, color: INK });
  } else {
    page.drawLine({
      start: { x: vx, y: y - 2 },
      end: { x: vx + lineW, y: y - 2 },
      thickness: 0.6,
      color: RULE,
    });
  }
}

/** Case à cocher carrée + libellé. */
function drawCheckbox(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  x: number,
  y: number,
  checked = false
): void {
  page.drawRectangle({
    x, y: y - 1, width: 9, height: 9,
    borderColor: FOREST, borderWidth: 0.8,
  });
  if (checked) {
    page.drawSvgPath("M 1.5 4.5 L 3.6 6.8 L 7.5 1.8", {
      x, y: y + 8, borderColor: FOREST, borderWidth: 1.3,
    });
  }
  page.drawText(label, { x: x + 16, y, size: 9, font: fonts.regular, color: INK });
}

export async function buildContractPdf(rawInput: {
  studio: StudioProfile;
  doc: ContractDoc;
}): Promise<Uint8Array> {
  const input = sanitizeDeep(rawInput);
  const d = input.doc;
  const st = input.studio;
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  const hero = await fetchHeroImage();
  let page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));
  await drawHeroPhoto(pdf, page, hero);
  drawTopRightCurve(page);

  const contentW = PAGE_W - 2 * MARGIN;

  // ── Titre principal ──
  drawLogo(page, MARGIN + 16, PAGE_H - MARGIN - 22, 0.85);
  centerText(page, "ROMERO PHOTOGRAPHY", PAGE_W / 2, PAGE_H - MARGIN - 62, 21, fonts.bold, FOREST);
  centerText(
    page,
    "Contrat de prestation photographique de mariage",
    PAGE_W / 2,
    PAGE_H - MARGIN - 84,
    11.5,
    fonts.regular,
    INK
  );
  page.drawLine({
    start: { x: PAGE_W / 2 - 70, y: PAGE_H - MARGIN - 96 },
    end: { x: PAGE_W / 2 + 70, y: PAGE_H - MARGIN - 96 },
    thickness: 1.2,
    color: SAGE,
  });

  // Référence + date (discret, en haut à droite)
  rightAlign(page, \`N° \${d.reference}\`, PAGE_W - MARGIN, PAGE_H - MARGIN - 14, 9, fonts.bold, FOREST);
  rightAlign(page, formatDate(d.issue_date), PAGE_W - MARGIN, PAGE_H - MARGIN - 26, 8.5, fonts.regular, MUTED);

  let y = PAGE_H - MARGIN - 124;

  const bottom = MARGIN + 76;
  const newPage = () => {
    drawFooter(page, fonts, st, { decorated: false });
    page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));
    y = PAGE_H - MARGIN - 24;
  };
  const ensureRoom = (need: number) => {
    if (y - need < bottom) newPage();
  };

  // ── Entre les soussignés ──
  page.drawText("Entre les soussignes :", { x: MARGIN, y, size: 10, font: fonts.italic, color: INK });
  y -= 26;

  // ── Bloc Le Photographe ──
  page.drawText("Le Photographe", { x: MARGIN, y, size: 12, font: fonts.bold, color: FOREST });
  page.drawLine({
    start: { x: MARGIN, y: y - 5 }, end: { x: MARGIN + 40, y: y - 5 },
    thickness: 1.3, color: SAGE,
  });
  y -= 20;
  const photographerLines = [
    \`Romero Photography - \${st.company_legal_name}\`,
    st.company_address,
    \`Tel. : \${st.company_phone}\`,
    "Site : https://romerophotography.fr",
    \`E-mail : \${st.company_email}\`,
    \`SIRET : \${st.company_siret}\`,
  ];
  for (const l of photographerLines) {
    y = drawParagraph(page, l, {
      x: MARGIN, y, font: fonts.regular, size: 9, color: INK, maxWidth: contentW, lineGap: 13,
    });
  }
  y -= 16;

  // ── Bloc Les Clients ──
  ensureRoom(120);
  page.drawText("Les Clients", { x: MARGIN, y, size: 12, font: fonts.bold, color: FOREST });
  page.drawLine({
    start: { x: MARGIN, y: y - 5 }, end: { x: MARGIN + 40, y: y - 5 },
    thickness: 1.3, color: SAGE,
  });
  y -= 22;
  drawFieldLine(page, fonts, "Nom & prenom", d.client.name, MARGIN, y, 230);
  y -= 17;
  drawFieldLine(page, fonts, "Adresse", d.client.address?.split("\\n")[0], MARGIN, y, 250);
  y -= 17;
  drawFieldLine(
    page, fonts, "Code postal / Ville",
    d.client.postal_city ?? d.client.address?.split("\\n").slice(1).join(" "),
    MARGIN, y, 210
  );
  y -= 17;
  drawFieldLine(page, fonts, "Telephone", d.client.phone, MARGIN, y, 220);
  y -= 17;
  drawFieldLine(page, fonts, "E-mail", d.client.email, MARGIN, y, 240);
  y -= 26;

  // ── Bloc Informations mariage ──
  ensureRoom(150);
  page.drawText("Informations concernant le mariage", { x: MARGIN, y, size: 12, font: fonts.bold, color: FOREST });
  page.drawLine({
    start: { x: MARGIN, y: y - 5 }, end: { x: MARGIN + 40, y: y - 5 },
    thickness: 1.3, color: SAGE,
  });
  y -= 22;
  drawFieldLine(page, fonts, "Date", d.wedding.date ? formatDate(d.wedding.date) : undefined, MARGIN, y, 180);
  y -= 17;
  drawFieldLine(page, fonts, "Lieu des preparatifs", d.wedding.prep_location, MARGIN, y, 200);
  y -= 17;
  drawFieldLine(page, fonts, "Lieu de la ceremonie", d.wedding.ceremony_location ?? d.wedding.location, MARGIN, y, 200);
  y -= 17;
  drawFieldLine(page, fonts, "Lieu de reception", d.wedding.reception_location, MARGIN, y, 210);
  y -= 17;
  drawFieldLine(
    page, fonts, "Nombre d'invites",
    d.wedding.guest_count ? String(d.wedding.guest_count) : undefined,
    MARGIN, y, 210
  );
  y -= 17;
  drawFieldLine(page, fonts, "Formule reservee", d.formula_name, MARGIN, y, 210);
  y -= 17;
  drawFieldLine(page, fonts, "Options", d.options, MARGIN, y, 240);
  y -= 30;

  // ── Articles ──
  const article = (num: number, title: string, body: string, minRoom = 70) => {
    ensureRoom(minRoom);
    page.drawText(\`\${num}. \${title}\`, { x: MARGIN, y, size: 11.5, font: fonts.bold, color: FOREST });
    y -= 17;
    y = drawParagraph(page, body, {
      x: MARGIN, y, font: fonts.regular, size: 9.5, color: INK, maxWidth: contentW, lineGap: 13,
    });
    y -= 14;
  };

  article(
    1,
    "Objet",
    "Le present contrat definit les conditions de realisation de la prestation photographique de mariage."
  );

  const deposit = Math.round((d.price_cents * d.deposit_pct) / 100);
  const balance = d.price_cents - deposit;
  const vatApplicable = st.vat_status === "yes";
  article(
    2,
    "Conditions financieres",
    \`Montant total : \${formatCents(d.price_cents)} EUR TTC - Acompte : \${formatCents(deposit)} EUR (\${d.deposit_pct} %). \` +
      \`Solde de \${formatCents(balance)} EUR a regler selon les conditions convenues.\${
        vatApplicable ? "" : " TVA non applicable, article 293 B du CGI."
      }\`
  );

  article(
    3,
    "Reservation",
    "La reservation est definitive a reception du contrat signe et de l'acompte."
  );

  article(
    4,
    "Obligations des clients",
    "Les clients s'engagent a communiquer toutes les informations utiles au bon deroulement de la prestation."
  );

  article(
    5,
    "Obligations du photographe",
    "Le photographe met tout en oeuvre pour realiser la prestation avec professionnalisme."
  );

  article(
    6,
    "Repas du photographe",
    "Si la formule comprend une presence pendant le repas (notamment les formules incluant l'ouverture de bal), les clients s'engagent a prevoir un repas complet pour le photographe."
  );

  article(
    7,
    "Livraison",
    "Les photographies seront livrees via une galerie privee en ligne."
  );

  article(
    8,
    "Droit d'auteur",
    "Le photographe conserve les droits d'auteur. Les clients disposent d'un droit d'usage prive."
  );

  // Article 9 : droit à l'image avec cases à cocher
  ensureRoom(80);
  page.drawText("9. Droit a l'image", { x: MARGIN, y, size: 11.5, font: fonts.bold, color: FOREST });
  y -= 20;
  drawCheckbox(page, fonts, "J'autorise Romero Photography a utiliser certaines photographies.", MARGIN, y);
  y -= 17;
  drawCheckbox(page, fonts, "Je refuse toute utilisation.", MARGIN, y);
  y -= 26;

  // Clauses additionnelles éventuelles
  if (d.cancellation_policy) {
    article(10, "Annulation", d.cancellation_policy);
  }
  if (st.contract_extra_clauses) {
    article(d.cancellation_policy ? 11 : 10, "Clauses additionnelles", st.contract_extra_clauses);
  }

  // ── Fait à / Le / Signatures ──
  ensureRoom(130);
  y -= 6;
  drawFieldLine(page, fonts, "Fait a", undefined, MARGIN, y, 130);
  drawFieldLine(page, fonts, "Le", undefined, MARGIN + 240, y, 130);
  y -= 34;

  page.drawText("Signature des Clients :", { x: MARGIN, y, size: 9.5, font: fonts.regular, color: INK });
  page.drawText('(precedee de la mention "Bon pour accord")', {
    x: MARGIN, y: y - 12, size: 7.5, font: fonts.italic, color: MUTED,
  });
  page.drawRectangle({
    x: MARGIN, y: y - 62, width: contentW * 0.44, height: 44,
    borderColor: FOREST, borderWidth: 0.8,
  });

  const rx = MARGIN + contentW * 0.52;
  page.drawText("Signature Romero Photography :", { x: rx, y, size: 9.5, font: fonts.regular, color: INK });
  page.drawRectangle({
    x: rx, y: y - 62, width: contentW * 0.44, height: 44,
    borderColor: FOREST, borderWidth: 0.8,
  });

  drawFooter(page, fonts, st);
  return pdf.save();
}
`;

fs.writeFileSync(p, head + contract);
console.log("contract rewritten");
