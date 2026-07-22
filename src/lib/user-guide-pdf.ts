/**
 * Générateur PDF du guide utilisateur Romero Studio.
 * ─────────────────────────────────────────────────
 * Manuel complet ~20 pages avec :
 *   - Cover professionnelle
 *   - Table des matières
 *   - Guide de démarrage (5 étapes)
 *   - Section détaillée par agent (Site / WhatsApp / Marketing / Admin)
 *   - Schémas de flow (dessinés avec pdf-lib primitives)
 *   - FAQ et dépannage
 *   - Contact support
 */
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, RGB } from "pdf-lib";

// ─── Palette de couleurs ────────────────────────────────────────────
const COLORS = {
  gold: rgb(0.72, 0.59, 0.35),
  goldLight: rgb(0.9, 0.83, 0.7),
  forest: rgb(0.18, 0.24, 0.18),
  cream: rgb(0.98, 0.96, 0.92),
  dark: rgb(0.15, 0.15, 0.15),
  grey: rgb(0.4, 0.4, 0.4),
  lightGrey: rgb(0.7, 0.7, 0.7),
  green: rgb(0.32, 0.68, 0.32),
  red: rgb(0.85, 0.35, 0.35),
  blue: rgb(0.24, 0.5, 0.76),
  pink: rgb(0.88, 0.19, 0.42),
};

// ─── Layout ─────────────────────────────────────────────────────────
const A4 = { w: 595, h: 842 };
const MARGIN = 50;
const CONTENT_W = A4.w - 2 * MARGIN;

// ─── Types ──────────────────────────────────────────────────────────
type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

// ─── Helpers texte ──────────────────────────────────────────────────
function wrapText(font: PDFFont, size: number, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxW) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: RGB,
  maxW: number,
  lineHeight = 1.35
): number {
  const lines = wrapText(font, size, text, maxW);
  let yCur = y;
  for (const line of lines) {
    page.drawText(line, { x, y: yCur, size, font, color });
    yCur -= size * lineHeight;
  }
  return yCur;
}

// ─── Header/Footer ──────────────────────────────────────────────────
function drawHeader(page: PDFPage, fonts: Fonts, pageNum: number, totalPages: number) {
  const y = A4.h - 25;
  page.drawText("Romero Studio · Guide d'utilisation", {
    x: MARGIN,
    y,
    size: 8,
    font: fonts.italic,
    color: COLORS.grey,
  });
  const pageStr = `Page ${pageNum} / ${totalPages}`;
  const w = fonts.italic.widthOfTextAtSize(pageStr, 8);
  page.drawText(pageStr, {
    x: A4.w - MARGIN - w,
    y,
    size: 8,
    font: fonts.italic,
    color: COLORS.grey,
  });
  page.drawLine({
    start: { x: MARGIN, y: y - 6 },
    end: { x: A4.w - MARGIN, y: y - 6 },
    thickness: 0.4,
    color: COLORS.goldLight,
  });
}

function drawFooter(page: PDFPage, fonts: Fonts) {
  page.drawText("romerophotography.fr · Créé par Pirabel Studio", {
    x: MARGIN,
    y: 25,
    size: 7.5,
    font: fonts.italic,
    color: COLORS.lightGrey,
  });
}

// ─── Blocs de contenu réutilisables ─────────────────────────────────
function drawSectionTitle(
  page: PDFPage,
  title: string,
  x: number,
  y: number,
  fonts: Fonts
): number {
  page.drawText(title, { x, y, size: 22, font: fonts.bold, color: COLORS.forest });
  page.drawLine({
    start: { x, y: y - 8 },
    end: { x: x + 60, y: y - 8 },
    thickness: 2,
    color: COLORS.gold,
  });
  return y - 32;
}

function drawSubTitle(
  page: PDFPage,
  title: string,
  x: number,
  y: number,
  fonts: Fonts
): number {
  page.drawText(title, { x, y, size: 14, font: fonts.bold, color: COLORS.gold });
  return y - 22;
}

function drawParagraph(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  fonts: Fonts,
  size = 10.5
): number {
  const after = drawWrapped(page, text, x, y, size, fonts.regular, COLORS.dark, CONTENT_W);
  return after - 8;
}

function drawBullet(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  fonts: Fonts,
  size = 10
): number {
  page.drawCircle({ x: x + 3, y: y + 3, size: 1.5, color: COLORS.gold });
  const after = drawWrapped(page, text, x + 14, y, size, fonts.regular, COLORS.dark, CONTENT_W - 14);
  return after - 4;
}

function drawInfoBox(
  page: PDFPage,
  content: string,
  x: number,
  y: number,
  height: number,
  fonts: Fonts,
  accent: RGB = COLORS.gold,
  label = "À noter"
): number {
  page.drawRectangle({
    x,
    y: y - height,
    width: CONTENT_W,
    height,
    color: COLORS.cream,
    borderColor: accent,
    borderWidth: 0.5,
  });
  page.drawRectangle({
    x,
    y: y - height,
    width: 3,
    height,
    color: accent,
  });
  page.drawText(label.toUpperCase(), {
    x: x + 12,
    y: y - 14,
    size: 8,
    font: fonts.bold,
    color: accent,
  });
  drawWrapped(
    page,
    content,
    x + 12,
    y - 30,
    9.5,
    fonts.regular,
    COLORS.dark,
    CONTENT_W - 24
  );
  return y - height - 12;
}

function drawStep(
  page: PDFPage,
  n: number,
  title: string,
  desc: string,
  x: number,
  y: number,
  fonts: Fonts
): number {
  // Numéro dans un cercle gold
  page.drawCircle({ x: x + 14, y: y - 4, size: 12, color: COLORS.gold });
  const numStr = String(n);
  const numW = fonts.bold.widthOfTextAtSize(numStr, 11);
  page.drawText(numStr, {
    x: x + 14 - numW / 2,
    y: y - 8,
    size: 11,
    font: fonts.bold,
    color: COLORS.cream,
  });
  // Titre + desc à droite du cercle
  page.drawText(title, { x: x + 36, y: y - 3, size: 12, font: fonts.bold, color: COLORS.forest });
  const after = drawWrapped(
    page,
    desc,
    x + 36,
    y - 20,
    10,
    fonts.regular,
    COLORS.dark,
    CONTENT_W - 36
  );
  return after - 10;
}

function drawKvPair(
  page: PDFPage,
  key: string,
  value: string,
  x: number,
  y: number,
  fonts: Fonts,
  keyW = 130
): number {
  page.drawText(key, { x, y, size: 10, font: fonts.bold, color: COLORS.forest });
  const after = drawWrapped(
    page,
    value,
    x + keyW,
    y,
    10,
    fonts.regular,
    COLORS.dark,
    CONTENT_W - keyW
  );
  return after - 4;
}

// ─── Schéma : flow chatbot → CRM ────────────────────────────────────
function drawFlowSchema(page: PDFPage, y: number, fonts: Fonts): number {
  const boxes = [
    { label: "Visiteur\nsite web", color: COLORS.blue },
    { label: "Chatbot\nRomero", color: COLORS.gold },
    { label: "Brouillon\nIA Telegram", color: COLORS.forest },
    { label: "Validation\nMickael", color: COLORS.green },
    { label: "E-mail\nau client", color: COLORS.pink },
  ];
  const boxW = 82;
  const boxH = 48;
  const gap = (CONTENT_W - boxes.length * boxW) / (boxes.length - 1);
  let x = MARGIN;
  boxes.forEach((b, i) => {
    // Boîte
    page.drawRectangle({
      x,
      y: y - boxH,
      width: boxW,
      height: boxH,
      color: b.color,
      borderColor: b.color,
      borderWidth: 1,
    });
    // Label sur 2 lignes
    const lines = b.label.split("\n");
    lines.forEach((line, li) => {
      const w = fonts.bold.widthOfTextAtSize(line, 9);
      page.drawText(line, {
        x: x + boxW / 2 - w / 2,
        y: y - 18 - li * 12,
        size: 9,
        font: fonts.bold,
        color: COLORS.cream,
      });
    });
    // Flèche
    if (i < boxes.length - 1) {
      const arrX = x + boxW + 3;
      const arrY = y - boxH / 2;
      page.drawLine({
        start: { x: arrX, y: arrY },
        end: { x: arrX + gap - 6, y: arrY },
        thickness: 1,
        color: COLORS.grey,
      });
      // Pointe
      page.drawLine({
        start: { x: arrX + gap - 6, y: arrY },
        end: { x: arrX + gap - 10, y: arrY + 3 },
        thickness: 1,
        color: COLORS.grey,
      });
      page.drawLine({
        start: { x: arrX + gap - 6, y: arrY },
        end: { x: arrX + gap - 10, y: arrY - 3 },
        thickness: 1,
        color: COLORS.grey,
      });
    }
    x += boxW + gap;
  });
  return y - boxH - 20;
}

// ─── Schéma agents ──────────────────────────────────────────────────
function drawAgentsSchema(page: PDFPage, y: number, fonts: Fonts): number {
  const centerX = A4.w / 2;
  const hubY = y - 60;
  // Hub Mickael au centre
  page.drawCircle({ x: centerX, y: hubY, size: 34, color: COLORS.forest });
  page.drawText("Mickael", {
    x: centerX - fonts.bold.widthOfTextAtSize("Mickael", 10) / 2,
    y: hubY + 2,
    size: 10,
    font: fonts.bold,
    color: COLORS.cream,
  });
  page.drawText("Studio", {
    x: centerX - fonts.regular.widthOfTextAtSize("Studio", 9) / 2,
    y: hubY - 10,
    size: 9,
    font: fonts.regular,
    color: COLORS.goldLight,
  });
  // 4 agents en cercle
  const agents = [
    { label: "Site", angle: 45, color: COLORS.blue },
    { label: "WhatsApp", angle: 135, color: COLORS.green },
    { label: "Marketing", angle: 225, color: COLORS.pink },
    { label: "Admin", angle: 315, color: COLORS.gold },
  ];
  const R = 110;
  agents.forEach((a) => {
    const rad = (a.angle * Math.PI) / 180;
    const ax = centerX + R * Math.cos(rad);
    const ay = hubY + R * Math.sin(rad);
    // Ligne connexion
    page.drawLine({
      start: { x: centerX, y: hubY },
      end: { x: ax, y: ay },
      thickness: 0.6,
      color: COLORS.lightGrey,
    });
    // Cercle agent
    page.drawCircle({ x: ax, y: ay, size: 24, color: a.color });
    // Label
    const w = fonts.bold.widthOfTextAtSize(a.label, 9);
    page.drawText(a.label, {
      x: ax - w / 2,
      y: ay - 3,
      size: 9,
      font: fonts.bold,
      color: COLORS.cream,
    });
  });
  return hubY - R - 30;
}

// ─── Page cover ─────────────────────────────────────────────────────
function drawCover(page: PDFPage, fonts: Fonts) {
  // Fond crème
  page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: COLORS.cream });
  // Bande gold horizontale
  page.drawRectangle({ x: 0, y: A4.h - 260, width: A4.w, height: 4, color: COLORS.gold });
  page.drawRectangle({ x: 0, y: 240, width: A4.w, height: 4, color: COLORS.gold });

  // Éyebrow
  page.drawText("ROMERO STUDIO", {
    x: MARGIN,
    y: A4.h - 300,
    size: 12,
    font: fonts.bold,
    color: COLORS.gold,
  });
  page.drawText("Manuel d'utilisation", {
    x: MARGIN,
    y: A4.h - 320,
    size: 11,
    font: fonts.italic,
    color: COLORS.grey,
  });

  // Titre géant
  page.drawText("Votre écosystème", {
    x: MARGIN,
    y: A4.h - 400,
    size: 36,
    font: fonts.bold,
    color: COLORS.forest,
  });
  page.drawText("d'agents IA", {
    x: MARGIN,
    y: A4.h - 445,
    size: 36,
    font: fonts.italic,
    color: COLORS.forest,
  });

  // Sous-titre
  page.drawText("Chatbot · Assistant WhatsApp · Marketing · Administratif", {
    x: MARGIN,
    y: A4.h - 490,
    size: 12,
    font: fonts.regular,
    color: COLORS.dark,
  });

  // Bloc bas
  page.drawText("Édition 2026 · v3", {
    x: MARGIN,
    y: 320,
    size: 10,
    font: fonts.italic,
    color: COLORS.grey,
  });
  page.drawText("Pour", {
    x: MARGIN,
    y: 290,
    size: 10,
    font: fonts.regular,
    color: COLORS.grey,
  });
  page.drawText("Mickael Romero", {
    x: MARGIN,
    y: 270,
    size: 18,
    font: fonts.bold,
    color: COLORS.forest,
  });
  page.drawText("Photographe de mariage · Nice, Côte d'Azur", {
    x: MARGIN,
    y: 250,
    size: 10,
    font: fonts.italic,
    color: COLORS.grey,
  });
}

// ─── Table des matières ─────────────────────────────────────────────
function drawTOC(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  drawSectionTitle(page, "Sommaire", MARGIN, y, fonts);
  y -= 30;

  const items = [
    { num: "1.", title: "Introduction — ce que fait la plateforme", page: 3 },
    { num: "2.", title: "Première connexion en 5 étapes", page: 4 },
    { num: "3.", title: "Le tableau de bord et l'Inbox unifié", page: 6 },
    { num: "4.", title: "Agent 1 · Chatbot du site", page: 8 },
    { num: "5.", title: "Agent 2 · WhatsApp & Telegram", page: 10 },
    { num: "6.", title: "Agent 3 · Marketing (Instagram, LinkedIn, Blog)", page: 12 },
    { num: "7.", title: "Agent 4 · Administratif (devis, contrats, factures)", page: 14 },
    { num: "8.", title: "Piloter les agents depuis un vocal Telegram", page: 16 },
    { num: "9.", title: "Studio Settings, sécurité et sauvegardes", page: 17 },
    { num: "10.", title: "FAQ et dépannage", page: 18 },
    { num: "11.", title: "Contact et support", page: 20 },
  ];

  items.forEach((item) => {
    page.drawText(item.num, {
      x: MARGIN,
      y,
      size: 11,
      font: fonts.bold,
      color: COLORS.gold,
    });
    page.drawText(item.title, {
      x: MARGIN + 24,
      y,
      size: 11,
      font: fonts.regular,
      color: COLORS.dark,
    });
    // Ligne pointillée
    const dotsX = MARGIN + 24 + fonts.regular.widthOfTextAtSize(item.title, 11) + 6;
    const dotsEnd = A4.w - MARGIN - 30;
    for (let dx = dotsX; dx < dotsEnd; dx += 4) {
      page.drawCircle({ x: dx, y: y + 3, size: 0.6, color: COLORS.lightGrey });
    }
    page.drawText(String(item.page), {
      x: A4.w - MARGIN - 18,
      y,
      size: 11,
      font: fonts.bold,
      color: COLORS.forest,
    });
    y -= 22;
  });
}

// ─── Page intro ─────────────────────────────────────────────────────
function drawIntro(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSectionTitle(page, "1. Introduction", MARGIN, y, fonts);

  y = drawParagraph(
    page,
    "Bienvenue Mickael. Cette plateforme est votre nouvel écosystème digital : quatre assistants intelligents qui travaillent pour vous, 24 h sur 24, sans que vous ayez besoin de coder ni de configurer quoi que ce soit de technique.",
    MARGIN,
    y,
    fonts
  );

  y -= 4;
  y = drawSubTitle(page, "Ce que fait chaque agent", MARGIN, y, fonts);
  y = drawBullet(page, "Agent Site · répond aux visiteurs de votre site, qualifie les prospects (nom, date, lieu, budget) et vous envoie un récap.", MARGIN, y, fonts);
  y = drawBullet(page, "Agent WhatsApp & Telegram · votre assistant personnel — envoyez un vocal, il crée le rendez-vous Google Agenda avec lien Meet.", MARGIN, y, fonts);
  y = drawBullet(page, "Agent Marketing · à partir d'un brief court, il génère trois publications prêtes à publier (Instagram, LinkedIn, Blog).", MARGIN, y, fonts);
  y = drawBullet(page, "Agent Administratif · génère devis, contrats et factures conformes à la législation française, envoyés en signature électronique.", MARGIN, y, fonts);

  y -= 6;
  y = drawSubTitle(page, "Vue d'ensemble", MARGIN, y, fonts);
  y = drawAgentsSchema(page, y, fonts);

  y = drawInfoBox(
    page,
    "Vous êtes au centre : tout ce que font les agents passe par votre validation. Ils préparent, vous décidez. Aucune action publique n'est faite dans votre dos.",
    MARGIN,
    y,
    56,
    fonts,
    COLORS.gold,
    "Le principe fondateur"
  );
}

// ─── Page première connexion ────────────────────────────────────────
function drawFirstConnection(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSectionTitle(page, "2. Première connexion", MARGIN, y, fonts);

  y = drawParagraph(
    page,
    "Cinq étapes suffisent pour tout mettre en route. Chaque étape est visuelle et guidée. Prévoyez cinq à sept minutes.",
    MARGIN,
    y,
    fonts
  );

  y -= 6;

  y = drawStep(
    page,
    1,
    "Ouvrez votre URL magique",
    "Bookmarquez le lien qui vous a été envoyé par SMS. C'est votre porte d'entrée sécurisée. Un simple clic vous emmène directement à l'écran de connexion.",
    MARGIN,
    y,
    fonts
  );

  y = drawStep(
    page,
    2,
    "Cliquez « Se connecter avec Google »",
    "Utilisez votre compte romerophotography.contact@gmail.com. Un clic, votre session est ouverte pour 14 jours. Aucun mot de passe à retenir.",
    MARGIN,
    y,
    fonts
  );

  y = drawStep(
    page,
    3,
    "Suivez le wizard de configuration",
    "Un assistant en 4 étapes vous accompagne : votre entreprise (via SIRET), Instagram, Google Agenda, coordonnées. Chaque étape peut être passée puis reprise plus tard.",
    MARGIN,
    y,
    fonts
  );

  y = drawStep(
    page,
    4,
    "Connectez Instagram et Google en 1 clic",
    "Deux boutons dans les Réglages du studio. Chaque connexion ouvre une fenêtre officielle Meta ou Google. Vous autorisez, c'est fait. Rien à copier-coller.",
    MARGIN,
    y,
    fonts
  );

  y = drawStep(
    page,
    5,
    "Activez votre bot Telegram",
    "Ouvrez t.me/romero_studio_bot depuis un smartphone. Tapez /start. Votre identifiant est capté automatiquement. À partir de là, envoyez-lui vocaux ou textes.",
    MARGIN,
    y,
    fonts
  );
}

function drawFirstConnection2(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSubTitle(page, "Ce qui est déjà prêt sans configuration", MARGIN, y, fonts);
  y = drawBullet(page, "Votre base de connaissances (100+ fiches) déjà chargée pour chaque agent", MARGIN, y, fonts);
  y = drawBullet(page, "Vos prompts systèmes calés sur votre univers artisan photographe", MARGIN, y, fonts);
  y = drawBullet(page, "L'accès aux clés API Claude, OpenAI, Meta, Google déjà configuré côté studio", MARGIN, y, fonts);
  y = drawBullet(page, "Les 7 automatismes récurrents (rappels RDV, relances factures, insights IG) déjà actifs", MARGIN, y, fonts);

  y -= 4;
  y = drawInfoBox(
    page,
    "Si vous préférez, l'onboarding est optionnel — vous pouvez utiliser la plateforme immédiatement et remplir les infos petit à petit. La bannière « Configurer maintenant » reste visible tant que ce n'est pas fait.",
    MARGIN,
    y,
    52,
    fonts,
    COLORS.blue,
    "Bon à savoir"
  );

  y -= 6;
  y = drawSubTitle(page, "Ce qu'on vous a préparé côté cadeaux techniques", MARGIN, y, fonts);
  y = drawKvPair(page, "Compte Google", "SSO configuré, vous ne créez rien", MARGIN, y, fonts);
  y = drawKvPair(page, "URL admin secrète", "Chemin aléatoire pour éviter les scanners de bots", MARGIN, y, fonts);
  y = drawKvPair(page, "Bot Telegram", "@romero_studio_bot déjà déployé", MARGIN, y, fonts);
  y = drawKvPair(page, "Whisper vocaux", "Transcription automatique de vos vocaux", MARGIN, y, fonts);
  y = drawKvPair(page, "Yousign", "Signature électronique prête à activer", MARGIN, y, fonts);
  y = drawKvPair(page, "PWA installable", "Ajoutez la plateforme sur votre écran d'accueil", MARGIN, y, fonts);
}

// ─── Page tableau de bord ───────────────────────────────────────────
function drawDashboard(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSectionTitle(page, "3. Tableau de bord", MARGIN, y, fonts);

  y = drawParagraph(
    page,
    "Après connexion, vous arrivez sur votre dashboard personnel. Il centralise tout ce dont vous avez besoin en un coup d'œil.",
    MARGIN,
    y,
    fonts
  );

  y = drawSubTitle(page, "Ce que vous voyez", MARGIN, y, fonts);
  y = drawBullet(page, "Bannière « Prochain mariage » avec compte à rebours J-XX", MARGIN, y, fonts);
  y = drawBullet(page, "6 cartes de statistiques (galeries, photos, articles, avis, messages, non lus)", MARGIN, y, fonts);
  y = drawBullet(page, "4 graphiques : messages reçus 30 j, photos par galerie, régions, catégories", MARGIN, y, fonts);
  y = drawBullet(page, "Liste des 5 derniers messages avec prévisualisation", MARGIN, y, fonts);
  y = drawBullet(page, "Menu latéral vers les 11 sections de l'admin", MARGIN, y, fonts);

  y -= 4;
  y = drawSubTitle(page, "L'Inbox unifié — votre nouveau réflexe matinal", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Une seule page pour lire tout ce qui arrive : formulaires de contact, chatbot, WhatsApp, Telegram, Instagram DM. Triés par date, filtrables par canal.",
    MARGIN,
    y,
    fonts
  );

  y = drawBullet(page, "Cliquez un message → vous voyez le fil complet à droite", MARGIN, y, fonts);
  y = drawBullet(page, "Bouton « Répondre par IA » → brouillon envoyé sur Telegram pour validation", MARGIN, y, fonts);
  y = drawBullet(page, "Zone de réponse en bas → tapez directement, envoyez", MARGIN, y, fonts);
  y = drawBullet(page, "Nouvelles conversations détectées automatiquement toutes les 30 secondes", MARGIN, y, fonts);
}

function drawDashboard2(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSubTitle(page, "Astuce · la palette de commandes Cmd+K", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Depuis n'importe où dans l'admin, appuyez sur Cmd+K (Mac) ou Ctrl+K (PC). Une palette de recherche apparaît. Tapez le nom d'un client, un lieu, un mot-clé : les résultats de toutes les sections s'affichent en direct.",
    MARGIN,
    y,
    fonts
  );

  y -= 2;
  y = drawSubTitle(page, "Le flow d'un lead type — schéma", MARGIN, y, fonts);
  y = drawFlowSchema(page, y, fonts);

  y = drawParagraph(
    page,
    "Un visiteur remplit votre formulaire, ou discute avec le chatbot. Le brouillon de réponse arrive sur votre Telegram. Vous validez d'un tap. L'e-mail part au client. Sans que vous n'ayez écrit une ligne.",
    MARGIN,
    y,
    fonts
  );

  y -= 6;
  y = drawInfoBox(
    page,
    "L'Inbox est votre unique point d'entrée matinal. Vous y traitez tout ce qui a bougé pendant la nuit en 5 minutes.",
    MARGIN,
    y,
    50,
    fonts,
    COLORS.green,
    "Recommandation"
  );
}

// ─── Page agent site ────────────────────────────────────────────────
function drawAgentSite(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSectionTitle(page, "4. Agent Site · chatbot", MARGIN, y, fonts);

  y = drawParagraph(
    page,
    "Un widget flottant apparaît en bas à droite de romerophotography.fr. Chaque visiteur peut discuter directement avec « Éclat », votre assistant virtuel de première qualification.",
    MARGIN,
    y,
    fonts
  );

  y = drawSubTitle(page, "Ce qu'il fait tout seul, 24/7", MARGIN, y, fonts);
  y = drawBullet(page, "Répond aux questions sur vos prestations, style, disponibilités", MARGIN, y, fonts);
  y = drawBullet(page, "Donne des fourchettes tarifaires indicatives sans jamais engager", MARGIN, y, fonts);
  y = drawBullet(page, "Qualifie le prospect (nom, email, date, lieu, budget) au fil de la conversation", MARGIN, y, fonts);
  y = drawBullet(page, "Vous envoie un e-mail récap dès qu'un lead qualifié est capté", MARGIN, y, fonts);
  y = drawBullet(page, "Ajoute automatiquement le lead dans votre CRM contacts", MARGIN, y, fonts);
  y = drawBullet(page, "Déclenche un brouillon de réponse IA envoyé sur votre Telegram", MARGIN, y, fonts);

  y = drawSubTitle(page, "Ce qu'il ne fait jamais", MARGIN, y, fonts);
  y = drawBullet(page, "Donner un prix fixe (toujours renvoyé à un devis personnalisé)", MARGIN, y, fonts);
  y = drawBullet(page, "Bloquer une date en votre nom", MARGIN, y, fonts);
  y = drawBullet(page, "Prétendre être humain — mais reste courtois même sur cette question", MARGIN, y, fonts);
  y = drawBullet(page, "Inventer des tarifs ou des témoignages", MARGIN, y, fonts);

  y -= 4;
  y = drawInfoBox(
    page,
    "Ton documentaire élégant — chaleureux, français impeccable, jamais racoleur. Il connaît vos 3 formules (Essentiel, Signature, Immersion), vos zones d'intervention, et 30+ FAQ métier.",
    MARGIN,
    y,
    54,
    fonts,
    COLORS.gold,
    "Le style « Éclat »"
  );
}

function drawAgentSite2(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSubTitle(page, "Où voir les conversations", MARGIN, y, fonts);
  y = drawKvPair(page, "Inbox unifié", "canal « Site » (couleur vert menthe)", MARGIN, y, fonts);
  y = drawKvPair(page, "Page agent", "/admin/agents/site · onglet Conversations", MARGIN, y, fonts);
  y = drawKvPair(page, "Notifications", "e-mail à chaque lead qualifié + brouillon sur Telegram", MARGIN, y, fonts);

  y -= 4;
  y = drawSubTitle(page, "Améliorer les réponses", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Dans la page /admin/agents/site vous avez 7 onglets : Aperçu, Configuration, Entraînement (prompt), Connaissances (KB), Test (Playground), Conversations, Statistiques.",
    MARGIN,
    y,
    fonts
  );

  y = drawBullet(page, "Onglet Connaissances : ajoutez ou modifiez les fiches KB (formules, style, tarifs)", MARGIN, y, fonts);
  y = drawBullet(page, "Onglet Entraînement : ajustez le prompt système (ton, règles, interdits)", MARGIN, y, fonts);
  y = drawBullet(page, "Onglet Test : testez vos changements avant qu'ils touchent les vrais visiteurs", MARGIN, y, fonts);

  y -= 4;
  y = drawInfoBox(
    page,
    "Le prompt et la KB sont fournis pré-remplis pour votre métier. Vous pouvez les affiner mais ce n'est pas obligatoire.",
    MARGIN,
    y,
    46,
    fonts,
    COLORS.blue,
    "Bon à savoir"
  );

  y -= 8;
  y = drawSubTitle(page, "En cas de problème", MARGIN, y, fonts);
  y = drawBullet(page, "Le chatbot ne répond plus : vérifiez /admin/agents/health, section « Anthropic Claude »", MARGIN, y, fonts);
  y = drawBullet(page, "Un lead qualifié n'arrive pas par e-mail : vérifiez /admin/messages puis Resend", MARGIN, y, fonts);
  y = drawBullet(page, "Le brouillon Telegram ne se déclenche pas : vérifiez que votre bot est actif", MARGIN, y, fonts);
}

// ─── Page agent WhatsApp ────────────────────────────────────────────
function drawAgentWhatsApp(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSectionTitle(page, "5. Agent WhatsApp & Telegram", MARGIN, y, fonts);

  y = drawParagraph(
    page,
    "Votre assistant personnel — le plus utile au quotidien. Envoyez un vocal ou un message texte à votre bot Telegram (ou à votre WhatsApp Business), il comprend et agit.",
    MARGIN,
    y,
    fonts
  );

  y = drawSubTitle(page, "Ce qu'il sait faire", MARGIN, y, fonts);
  y = drawBullet(page, "Créer un rendez-vous Google Agenda avec ou sans lien Meet visio", MARGIN, y, fonts);
  y = drawBullet(page, "Trouver des créneaux libres en respectant vos horaires de travail", MARGIN, y, fonts);
  y = drawBullet(page, "Lister vos prochains RDV (récap semaine, journée)", MARGIN, y, fonts);
  y = drawBullet(page, "Modifier, décaler, supprimer un RDV existant (avec confirmation)", MARGIN, y, fonts);
  y = drawBullet(page, "Consulter vos leads, factures, brouillons IA en attente", MARGIN, y, fonts);
  y = drawBullet(page, "Ajouter un contact au CRM depuis un vocal", MARGIN, y, fonts);
  y = drawBullet(page, "Créer un brief marketing à partir d'un vocal", MARGIN, y, fonts);

  y -= 2;
  y = drawSubTitle(page, "Exemples de vocaux qui marchent", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "« Prends RDV visio demain 15h avec Sophie, 30 minutes, sujet mariage juin »",
    MARGIN,
    y,
    fonts,
    9.5
  );
  y = drawParagraph(page, "« Suis-je libre samedi entre 14h et 18h ? »", MARGIN, y, fonts, 9.5);
  y = drawParagraph(page, "« Trouve-moi 3 créneaux de 1h la semaine prochaine »", MARGIN, y, fonts, 9.5);
  y = drawParagraph(page, "« Ajoute Léa & Antoine au CRM, mariage 15 juin, sophie@... »", MARGIN, y, fonts, 9.5);
  y = drawParagraph(page, "« Prépare un brief marketing sur le mariage d'Anastasia »", MARGIN, y, fonts, 9.5);

  y -= 6;
  y = drawInfoBox(
    page,
    "Whisper transcrit vos vocaux en français, avec une précision de 95%+. Pour les prénoms rares, l'assistant peut demander confirmation.",
    MARGIN,
    y,
    50,
    fonts,
    COLORS.gold,
    "Vocaux — comment ça marche"
  );
}

function drawAgentWhatsApp2(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSubTitle(page, "Commandes système", MARGIN, y, fonts);
  y = drawKvPair(page, "/start", "activation du bot (première fois)", MARGIN, y, fonts, 90);
  y = drawKvPair(page, "/status ou /etat", "récap du jour (RDV, leads, approvals)", MARGIN, y, fonts, 90);
  y = drawKvPair(page, "/help ou /aide", "liste des commandes disponibles", MARGIN, y, fonts, 90);

  y -= 4;
  y = drawSubTitle(page, "Ce que fait le bot Telegram tout seul", MARGIN, y, fonts);
  y = drawBullet(page, "Vous notifie 15 min avant chaque RDV visio", MARGIN, y, fonts);
  y = drawBullet(page, "Rappelle chaque mariage 24h à l'avance (cron automatique 6h)", MARGIN, y, fonts);
  y = drawBullet(page, "Récap hebdo chaque lundi matin à 7h", MARGIN, y, fonts);
  y = drawBullet(page, "Vous transmet chaque brouillon IA de réponse à valider", MARGIN, y, fonts);
  y = drawBullet(page, "Alerte si un commentaire ou mention Instagram arrive", MARGIN, y, fonts);

  y -= 4;
  y = drawSubTitle(page, "Sécurité — bot réservé à vous", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Votre identifiant Telegram est enregistré à la première utilisation. Aucune autre personne ne peut discuter avec le bot — les autres reçoivent un message poli les redirigeant vers votre page contact.",
    MARGIN,
    y,
    fonts
  );

  y -= 4;
  y = drawInfoBox(
    page,
    "Si vous changez de téléphone, il suffit de retaper /start depuis le nouveau. Votre nouvel identifiant est capturé automatiquement.",
    MARGIN,
    y,
    48,
    fonts,
    COLORS.blue,
    "Astuce"
  );
}

// ─── Page agent Marketing ───────────────────────────────────────────
function drawAgentMarketing(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSectionTitle(page, "6. Agent Marketing", MARGIN, y, fonts);

  y = drawParagraph(
    page,
    "Vous lui donnez un brief court (texte ou vocal), il génère trois contenus prêts à publier : post Instagram, post LinkedIn, article de blog SEO complet.",
    MARGIN,
    y,
    fonts
  );

  y = drawSubTitle(page, "Le flow de production", MARGIN, y, fonts);
  y = drawStep(
    page,
    1,
    "Créer un brief",
    "Sur /admin/agents/marketing, onglet Briefs. Vous pouvez taper ou dicter à l'oral. Ajoutez les photos que vous souhaitez publier.",
    MARGIN,
    y,
    fonts
  );
  y = drawStep(
    page,
    2,
    "Générer les 3 outputs",
    "En 20 secondes environ, l'agent produit : caption IG avec 25 hashtags stratifiés, post LinkedIn formaté, article blog 800-1200 mots SEO.",
    MARGIN,
    y,
    fonts
  );
  y = drawStep(
    page,
    3,
    "Éditer si besoin, publier ou programmer",
    "Chaque output est éditable dans un éditeur riche. Un clic pour publier direct sur Instagram, un clic pour programmer à une date/heure future.",
    MARGIN,
    y,
    fonts
  );

  y -= 2;
  y = drawSubTitle(page, "Cross-post Facebook Page automatique", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Chaque publication Instagram est automatiquement partagée sur votre Page Facebook liée, sans effort supplémentaire.",
    MARGIN,
    y,
    fonts
  );

  y -= 2;
  y = drawSubTitle(page, "Style éditorial", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Ton documentaire élégant, chaleureux, jamais racoleur. Signature « Éclat ». Hashtags mixés en 3 tiers (haut/moyen/bas volume). 50 idées de sujets préchargées.",
    MARGIN,
    y,
    fonts
  );
}

function drawAgentMarketing2(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSubTitle(page, "Publier des Stories et Reels", MARGIN, y, fonts);
  y = drawBullet(page, "Feed post : format historique (photos + caption)", MARGIN, y, fonts);
  y = drawBullet(page, "Story : 24h de visibilité, format vertical 9:16", MARGIN, y, fonts);
  y = drawBullet(page, "Reel : vidéo 15-90 secondes, format le plus performant en 2026", MARGIN, y, fonts);

  y -= 4;
  y = drawSubTitle(page, "Voir les performances", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Toutes les 6 heures, un cron automatique récupère les likes/reach/commentaires de vos posts. Visibles dans /admin/analytics onglet « Top posts Instagram ».",
    MARGIN,
    y,
    fonts
  );

  y -= 4;
  y = drawSubTitle(page, "Programmer un calendrier éditorial", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Onglet « Calendrier éditorial » : vous voyez tous vos posts passés + programmés. Vous pouvez glisser-déposer pour changer les dates.",
    MARGIN,
    y,
    fonts
  );

  y -= 4;
  y = drawInfoBox(
    page,
    "Rythme recommandé : 3-4 posts Instagram par semaine, 1 post LinkedIn par mois, 1 article blog toutes les 2 semaines. Ni plus (saturation) ni moins (oubli).",
    MARGIN,
    y,
    54,
    fonts,
    COLORS.gold,
    "Recommandation"
  );

  y -= 8;
  y = drawSubTitle(page, "Répondre aux DM Instagram", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Les messages privés Instagram arrivent automatiquement dans l'Inbox unifié (canal rose « Instagram »). Vous pouvez répondre depuis l'admin, votre réponse part directement.",
    MARGIN,
    y,
    fonts
  );

  y -= 4;
  y = drawInfoBox(
    page,
    "Vous êtes notifié sur Telegram à chaque nouveau commentaire ou mention sur vos posts, avec un lien direct pour aller sur Instagram y répondre.",
    MARGIN,
    y,
    50,
    fonts,
    COLORS.pink,
    "Instagram — notifications"
  );
}

// ─── Page agent Admin ───────────────────────────────────────────────
function drawAgentAdmin(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSectionTitle(page, "7. Agent Administratif", MARGIN, y, fonts);

  y = drawParagraph(
    page,
    "Il génère vos documents juridiques et commerciaux en quelques secondes, tous conformes à la législation française (mentions obligatoires, RGPD, TVA franchise micro).",
    MARGIN,
    y,
    fonts
  );

  y = drawSubTitle(page, "Documents générés", MARGIN, y, fonts);
  y = drawBullet(page, "Devis : proposition commerciale avec référence, prestations, total, validité 30j", MARGIN, y, fonts);
  y = drawBullet(page, "Contrat : version juridique complète avec 10 clauses obligatoires (RGPD, force majeure, annulation, cession droits, etc.)", MARGIN, y, fonts);
  y = drawBullet(page, "Facture : numérotation continue légale, mentions obligatoires, pénalités retard, IBAN", MARGIN, y, fonts);
  y = drawBullet(page, "Facture d'acompte + facture de solde (obligation dès qu'acompte encaissé)", MARGIN, y, fonts);
  y = drawBullet(page, "Avoir : en cas d'annulation ou d'erreur sur une facture", MARGIN, y, fonts);

  y -= 2;
  y = drawSubTitle(page, "Le CRM Contacts", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Chaque couple qui signe un contrat devient automatiquement un contact CRM. Vous pouvez suivre le nombre de documents, montant facturé, historique complet.",
    MARGIN,
    y,
    fonts
  );

  y -= 2;
  y = drawSubTitle(page, "Automatismes actifs", MARGIN, y, fonts);
  y = drawKvPair(page, "Relances impayés", "cron quotidien 9h (3 niveaux progressifs)", MARGIN, y, fonts);
  y = drawKvPair(page, "Devis expirés", "cron mercredi 10h (rappel du client)", MARGIN, y, fonts);
  y = drawKvPair(page, "Comptage mariage", "notification J-30 et J-7 avant chaque prestation", MARGIN, y, fonts);
}

function drawAgentAdmin2(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSubTitle(page, "Signature électronique via Yousign", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Chaque contrat peut être envoyé pour signature électronique. Les mariés reçoivent un lien par e-mail, signent en 30 secondes par code SMS. Coût : ~2 € par procédure (à votre charge). Conforme eIDAS niveau simple.",
    MARGIN,
    y,
    fonts
  );

  y -= 4;
  y = drawSubTitle(page, "Intégration comptable optionnelle", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Si vous utilisez Pennylane ou Freebe, l'agent peut synchroniser vos factures automatiquement. Configuration dans /admin/agents/admin onglet Configuration.",
    MARGIN,
    y,
    fonts
  );

  y -= 4;
  y = drawSubTitle(page, "Statut fiscal", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Vos documents sont générés en franchise TVA (mention « TVA non applicable, art. 293 B du CGI »), conformément au régime micro-entrepreneur. Seuil de sortie de franchise : 34 400 € HT/an (2026). L'agent vous alerte si vous approchez du seuil.",
    MARGIN,
    y,
    fonts
  );

  y -= 4;
  y = drawInfoBox(
    page,
    "Chaque facture reçoit un numéro strictement séquentiel (FAC-2026-XXX). Impossible de créer un doublon ou de sauter un numéro — obligation légale respectée automatiquement.",
    MARGIN,
    y,
    58,
    fonts,
    COLORS.gold,
    "Sécurité comptable"
  );

  y -= 8;
  y = drawSubTitle(page, "Export CSV pour votre comptable", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Sur /admin/calendar, boutons pour télécharger : CSV Excel de tous vos contacts, vCard pour import téléphone, PDF planning mensuel imprimable.",
    MARGIN,
    y,
    fonts
  );
}

// ─── Page pilotage Telegram ─────────────────────────────────────────
function drawTelegramPiloting(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSectionTitle(page, "8. Piloter tout depuis Telegram", MARGIN, y, fonts);

  y = drawParagraph(
    page,
    "Depuis votre bot Telegram, vous pouvez interroger et modifier les 4 agents avec des vocaux ou des messages courts. 17 outils sont exposés au total.",
    MARGIN,
    y,
    fonts
  );

  y = drawSubTitle(page, "Consulter — vocaux qui marchent", MARGIN, y, fonts);
  y = drawBullet(page, "« Quels sont mes leads en attente ? » → liste des 5 derniers leads chatbot", MARGIN, y, fonts);
  y = drawBullet(page, "« Combien de brouillons IA à valider ? » → nombre + liens directs", MARGIN, y, fonts);
  y = drawBullet(page, "« Factures impayées ? » → liste + montant total dû", MARGIN, y, fonts);
  y = drawBullet(page, "« Mes prochains mariages ? » → J-XX + lieu", MARGIN, y, fonts);
  y = drawBullet(page, "« Comment marche mon dernier post IG ? » → likes/reach", MARGIN, y, fonts);
  y = drawBullet(page, "« État général ce matin » → récap système complet en un message", MARGIN, y, fonts);

  y = drawSubTitle(page, "Créer — vocaux qui marchent", MARGIN, y, fonts);
  y = drawBullet(page, "« Prends RDV demain 15h avec Sophie » → événement Google Calendar créé", MARGIN, y, fonts);
  y = drawBullet(page, "« Ajoute Sophie & Marc au CRM, mariage juin, sophie@... » → contact créé", MARGIN, y, fonts);
  y = drawBullet(page, "« Prépare un brief marketing sur le mariage de Léa » → brief dans agent Marketing", MARGIN, y, fonts);

  y -= 6;
  y = drawInfoBox(
    page,
    "Pour publier un vrai post Instagram ou générer un devis PDF, terminez dans /admin/agents/... Le vocal Telegram est parfait pour la consultation et la préparation, l'admin pour la finalisation.",
    MARGIN,
    y,
    58,
    fonts,
    COLORS.blue,
    "Ce que Telegram ne fait pas"
  );
}

// ─── Page Studio Settings + Sécurité ────────────────────────────────
function drawStudioAndSecurity(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSectionTitle(page, "9. Studio Settings & sécurité", MARGIN, y, fonts);

  y = drawSubTitle(page, "Studio Settings — un lieu pour tout gérer", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Dans /admin/agents/studio, vous avez un menu unique pour toutes vos informations partagées entre les agents.",
    MARGIN,
    y,
    fonts
  );
  y = drawBullet(page, "Vos comptes connectés (Instagram, Google Agenda, Telegram, WhatsApp)", MARGIN, y, fonts);
  y = drawBullet(page, "Votre entreprise (SIRET, statut, adresse — auto-remplissable via API INSEE)", MARGIN, y, fonts);
  y = drawBullet(page, "Vos coordonnées de contact (e-mail leads, téléphone public)", MARGIN, y, fonts);

  y -= 2;
  y = drawSubTitle(page, "Sécurité — URL admin cachée", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "L'URL de votre admin n'est pas indexée. Un chemin aléatoire de 30 caractères sert de porte d'entrée. Sans ce chemin, les bots qui scannent votre site pour trouver /admin, /wp-admin, /login ne trouvent rien.",
    MARGIN,
    y,
    fonts
  );

  y -= 2;
  y = drawSubTitle(page, "Panneau de santé système", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Sur /admin/agents/health, un test en direct de 22 checkpoints : DB, tokens externes (Meta, Google, OpenAI), webhooks, agents, KB, activité récente. Rechargez la page pour rafraîchir.",
    MARGIN,
    y,
    fonts
  );

  y -= 2;
  y = drawSubTitle(page, "Sauvegardes", MARGIN, y, fonts);
  y = drawBullet(page, "Base PostgreSQL : sauvegarde automatique quotidienne par Supabase", MARGIN, y, fonts);
  y = drawBullet(page, "Contacts CRM : export CSV/vCard à volonté depuis /admin/calendar", MARGIN, y, fonts);
  y = drawBullet(page, "KB des agents : backup JSON versionné dans le git du projet", MARGIN, y, fonts);
}

// ─── Page FAQ / dépannage ───────────────────────────────────────────
function drawFAQ(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSectionTitle(page, "10. FAQ et dépannage", MARGIN, y, fonts);

  const faqs = [
    {
      q: "Le chatbot du site ne répond plus.",
      a: "Ouvrez /admin/agents/health. Regardez la section « Anthropic Claude ». Si rouge, le token est peut-être expiré. Contactez le studio dev pour renouveler.",
    },
    {
      q: "Un lead a rempli le formulaire mais je n'ai pas reçu l'e-mail.",
      a: "Vérifiez /admin/messages (le message y est). Puis /admin/agents/health, section « E-mail leads ». Si le service Resend est down, l'e-mail est en attente.",
    },
    {
      q: "Mon bot Telegram ne répond pas à mes vocaux.",
      a: "Tapez /help. Si aucune réponse : votre bot a peut-être été révoqué. Contactez le studio.",
    },
    {
      q: "Je n'arrive pas à me connecter à /admin.",
      a: "Utilisez votre URL magique une nouvelle fois. Elle re-pose le cookie de session. Puis cliquez « Se connecter avec Google ».",
    },
    {
      q: "Une publication Instagram a échoué.",
      a: "Vérifiez /admin/agents/marketing onglet Briefs. Le message d'erreur Meta est affiché. Souvent : token expiré (à reconnecter).",
    },
    {
      q: "Un devis PDF est mal formaté.",
      a: "Vérifiez que Studio Settings a bien votre SIRET, nom légal et adresse. Sans ces infos, le PDF utilise des placeholders.",
    },
  ];

  faqs.forEach((f) => {
    page.drawText("Q. " + f.q, {
      x: MARGIN,
      y,
      size: 11,
      font: fonts.bold,
      color: COLORS.gold,
    });
    y -= 15;
    y = drawWrapped(
      page,
      "R. " + f.a,
      MARGIN,
      y,
      10,
      fonts.regular,
      COLORS.dark,
      CONTENT_W
    );
    y -= 12;
  });
}

function drawFAQ2(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSubTitle(page, "Bonnes pratiques quotidiennes", MARGIN, y, fonts);
  y = drawBullet(page, "Ouvrez /admin/inbox chaque matin (5 min pour tout balayer)", MARGIN, y, fonts);
  y = drawBullet(page, "Vérifiez /admin/approvals — les brouillons IA à valider", MARGIN, y, fonts);
  y = drawBullet(page, "Répondez à la question / commentaire IG dans les 24h (via Inbox)", MARGIN, y, fonts);
  y = drawBullet(page, "Publiez 2-3 posts Instagram par semaine, 1 LinkedIn par mois", MARGIN, y, fonts);

  y -= 2;
  y = drawSubTitle(page, "Ce qui doit rester manuel", MARGIN, y, fonts);
  y = drawBullet(page, "L'appel visio du prospect qualifié (le chatbot ne le fait pas à votre place)", MARGIN, y, fonts);
  y = drawBullet(page, "La photo elle-même le jour du mariage", MARGIN, y, fonts);
  y = drawBullet(page, "La retouche photo (Lightroom + Photoshop)", MARGIN, y, fonts);
  y = drawBullet(page, "La décision de prix final sur un devis particulier", MARGIN, y, fonts);
  y = drawBullet(page, "Les signatures manuscrites d'un contrat papier (préférez Yousign)", MARGIN, y, fonts);

  y -= 4;
  y = drawInfoBox(
    page,
    "Cette plateforme automatise 80% de votre back-office. Les 20% restants — l'humain, la créativité, la relation vraie — restent votre force.",
    MARGIN,
    y,
    54,
    fonts,
    COLORS.gold,
    "Philosophie"
  );
}

// ─── Page contact ───────────────────────────────────────────────────
function drawContact(page: PDFPage, fonts: Fonts) {
  let y = A4.h - 90;
  y = drawSectionTitle(page, "11. Contact et support", MARGIN, y, fonts);

  y = drawParagraph(
    page,
    "Cette plateforme a été conçue et développée par le studio Pirabel Labs, basé au Bénin, avec une équipe technique dédiée pour vous accompagner.",
    MARGIN,
    y,
    fonts
  );

  y -= 6;
  y = drawSubTitle(page, "Pirabel Labs", MARGIN, y, fonts);
  y = drawKvPair(page, "Site web", "pirabellabs.com", MARGIN, y, fonts, 100);
  y = drawKvPair(page, "E-mail", "contact@pirabellabs.com", MARGIN, y, fonts, 100);
  y = drawKvPair(page, "Direction", "Gildas Lissanon", MARGIN, y, fonts, 100);

  y -= 6;
  y = drawSubTitle(page, "En cas d'incident critique", MARGIN, y, fonts);
  y = drawBullet(page, "Envoyez un e-mail à contact@pirabellabs.com avec « URGENT » en objet", MARGIN, y, fonts);
  y = drawBullet(page, "Décrivez le problème + capture d'écran si possible", MARGIN, y, fonts);
  y = drawBullet(page, "Réponse sous 4 heures ouvrées (9h-19h heure française)", MARGIN, y, fonts);

  y -= 6;
  y = drawSubTitle(page, "Évolutions et nouvelles fonctionnalités", MARGIN, y, fonts);
  y = drawParagraph(
    page,
    "Vos remarques et idées d'amélioration sont bienvenues. La plateforme évolue régulièrement. Signalez-nous ce qui vous manque, ce qui pourrait être plus simple, ce que vous imaginez.",
    MARGIN,
    y,
    fonts
  );

  y -= 20;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4.w - MARGIN, y },
    thickness: 0.5,
    color: COLORS.gold,
  });
  y -= 22;

  page.drawText("Merci de votre confiance,", {
    x: MARGIN,
    y,
    size: 11,
    font: fonts.italic,
    color: COLORS.dark,
  });
  y -= 22;
  page.drawText("L'équipe Pirabel Labs.", {
    x: MARGIN,
    y,
    size: 12,
    font: fonts.bold,
    color: COLORS.gold,
  });
}

// ─── Point d'entrée principal ───────────────────────────────────────
export async function buildUserGuidePDF(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Romero Studio — Guide d'utilisation");
  pdf.setAuthor("Pirabel Labs");
  pdf.setSubject("Manuel d'utilisation de la plateforme d'agents IA");
  pdf.setKeywords(["romero", "photographe", "manuel", "agents ia"]);
  pdf.setCreator("Pirabel Labs / pdf-lib");

  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };

  const pages: Array<(p: PDFPage) => void> = [
    (p) => drawCover(p, fonts),
    (p) => drawTOC(p, fonts),
    (p) => drawIntro(p, fonts),
    (p) => drawFirstConnection(p, fonts),
    (p) => drawFirstConnection2(p, fonts),
    (p) => drawDashboard(p, fonts),
    (p) => drawDashboard2(p, fonts),
    (p) => drawAgentSite(p, fonts),
    (p) => drawAgentSite2(p, fonts),
    (p) => drawAgentWhatsApp(p, fonts),
    (p) => drawAgentWhatsApp2(p, fonts),
    (p) => drawAgentMarketing(p, fonts),
    (p) => drawAgentMarketing2(p, fonts),
    (p) => drawAgentAdmin(p, fonts),
    (p) => drawAgentAdmin2(p, fonts),
    (p) => drawTelegramPiloting(p, fonts),
    (p) => drawStudioAndSecurity(p, fonts),
    (p) => drawFAQ(p, fonts),
    (p) => drawFAQ2(p, fonts),
    (p) => drawContact(p, fonts),
  ];

  pages.forEach((renderer, i) => {
    const page = pdf.addPage([A4.w, A4.h]);
    // Cover n'a pas de header/footer
    if (i > 0) {
      drawHeader(page, fonts, i + 1, pages.length);
      drawFooter(page, fonts);
    }
    renderer(page);
  });

  return pdf.save();
}
