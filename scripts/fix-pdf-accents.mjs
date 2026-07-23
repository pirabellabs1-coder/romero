import fs from "node:fs";
const p = "src/lib/pdf-generator.ts";
let s = fs.readFileSync(p, "utf8");

// WinAnsi (CP1252) supporte tous ces accents + « » ° œ. On restaure les
// libellés fixes qui avaient été écrits en ASCII par excès de prudence.
const R = [
  ["Nice, Cote d'Azur & France", "Nice, Côte d'Azur & France"],
  ['rightAlign(page, "N " + doc.reference', 'rightAlign(page, "N° " + doc.reference'],
  ['rightAlign(page, "N " + d.reference', 'rightAlign(page, "N° " + d.reference'],
  ['"DATE D\'ECHEANCE"', '"DATE D\'ÉCHÉANCE"'],
  ['label: "DESIGNATION"', 'label: "DÉSIGNATION"'],
  ['label: "DETAIL"', 'label: "DÉTAIL"'],
  ['label: "QUANTITE"', 'label: "QUANTITÉ"'],
  ['"ACOMPTE A LA RESERVATION"', '"ACOMPTE À LA RÉSERVATION"'],
  ['"MONTANT TOTAL TTC"', '"MONTANT TOTAL TTC"'],
  ['"MONTANT A PAYER"', '"MONTANT À PAYER"'],
  ['"ACOMPTE DEJA VERSE"', '"ACOMPTE DÉJÀ VERSÉ"'],
  ['\'(Precedee de la mention "Bon pour accord")\'', '\'(Précédée de la mention « Bon pour accord »)\''],
  ['"Devis valable " + validity + " jours a compter de sa date d\'emission."', '"Devis valable " + validity + " jours à compter de sa date d\'émission."'],
  ['"Capturer vos emotions, sublimer vos souvenirs."', '"Capturer vos émotions, sublimer vos souvenirs."'],
  [
    '"En cas de retard de paiement : penalite de 3x le taux d\'interet legal + indemnite forfaitaire de 40 EUR (art. L441-10 C. com.)."',
    '"En cas de retard de paiement : pénalité de 3x le taux d\'intérêt légal + indemnité forfaitaire de 40 EUR (art. L441-10 C. com.)."',
  ],
  ['"Paiement a reception, par virement bancaire."', '"Paiement à réception, par virement bancaire."'],
  ['"(a communiquer)"', '"(à communiquer)"'],
  ['"CONDITIONS DE PAIEMENT"', '"CONDITIONS DE PAIEMENT"'],
  ['"COORDONNEES BANCAIRES"', '"COORDONNÉES BANCAIRES"'],

  // ── Contrat ──
  ['"Contrat de prestation photographique de mariage"', '"Contrat de prestation photographique de mariage"'],
  ['page.drawText("Entre les soussignes :"', 'page.drawText("Entre les soussignés :"'],
  ['"Tel. : " + st.company_phone', '"Tél. : " + st.company_phone'],
  ['"Nom & prenom"', '"Nom & prénom"'],
  ['"Telephone"', '"Téléphone"'],
  ['"Lieu des preparatifs"', '"Lieu des préparatifs"'],
  ['"Lieu de la ceremonie"', '"Lieu de la cérémonie"'],
  ['"Lieu de reception"', '"Lieu de réception"'],
  ['"Nombre d\'invites"', '"Nombre d\'invités"'],
  ['"Formule reservee"', '"Formule réservée"'],
  ['"Informations concernant le mariage"', '"Informations concernant le mariage"'],
  [
    '"Le present contrat definit les conditions de realisation de la prestation photographique de mariage."',
    '"Le présent contrat définit les conditions de réalisation de la prestation photographique de mariage."',
  ],
  ['"Conditions financieres"', '"Conditions financières"'],
  [
    '"Montant total : " + formatCents(d.price_cents) + " EUR TTC - Acompte : " +\n    formatCents(deposit) + " EUR (" + d.deposit_pct + " %). Solde de " +\n    formatCents(balance) + " EUR a regler selon les conditions convenues."',
    '"Montant total : " + formatCents(d.price_cents) + " EUR TTC - Acompte : " +\n    formatCents(deposit) + " EUR (" + d.deposit_pct + " %). Solde de " +\n    formatCents(balance) + " EUR à régler selon les conditions convenues."',
  ],
  ['"Reservation"', '"Réservation"'],
  ['"La reservation est definitive a reception du contrat signe et de l\'acompte."', '"La réservation est définitive à réception du contrat signé et de l\'acompte."'],
  ['"Obligations des clients"', '"Obligations des clients"'],
  ['"Les clients s\'engagent a communiquer toutes les informations utiles au bon deroulement de la prestation."', '"Les clients s\'engagent à communiquer toutes les informations utiles au bon déroulement de la prestation."'],
  ['"Obligations du photographe"', '"Obligations du photographe"'],
  ['"Le photographe met tout en oeuvre pour realiser la prestation avec professionnalisme."', '"Le photographe met tout en œuvre pour réaliser la prestation avec professionnalisme."'],
  ['"Repas du photographe"', '"Repas du photographe"'],
  ['"Si la formule comprend une presence pendant le repas (notamment les formules incluant l\'ouverture de bal), les clients s\'engagent a prevoir un repas complet pour le photographe."', '"Si la formule comprend une présence pendant le repas (notamment les formules incluant l\'ouverture de bal), les clients s\'engagent à prévoir un repas complet pour le photographe."'],
  ['"Les photographies seront livrees via une galerie privee en ligne."', '"Les photographies seront livrées via une galerie privée en ligne."'],
  ['"Droit d\'auteur"', '"Droit d\'auteur"'],
  ['"Le photographe conserve les droits d\'auteur. Les clients disposent d\'un droit d\'usage prive."', '"Le photographe conserve les droits d\'auteur. Les clients disposent d\'un droit d\'usage privé."'],
  ['page.drawText("9. Droit a l\'image"', 'page.drawText("9. Droit à l\'image"'],
  ['"J\'autorise Romero Photography a utiliser certaines photographies."', '"J\'autorise Romero Photography à utiliser certaines photographies."'],
  ['drawFieldLine(page, fonts, "Fait a", undefined', 'drawFieldLine(page, fonts, "Fait à", undefined'],
  [' TVA non applicable, article 293 B du CGI."', ' TVA non applicable, article 293 B du CGI."'],
];

let applied = 0, missed = [];
for (const [from, to] of R) {
  if (s.includes(from)) { s = s.split(from).join(to); applied++; }
  else if (from !== to) missed.push(from.slice(0, 55));
}
fs.writeFileSync(p, s);
console.log("accents applied:", applied);
if (missed.length) { console.log("NOT FOUND:"); for (const m of missed) console.log("  " + m); }
