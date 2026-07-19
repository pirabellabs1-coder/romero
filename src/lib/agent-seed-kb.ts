/**
 * Base de connaissances de démarrage pour les 4 agents.
 * ────────────────────────────────────────────────────────
 * Contenu 100 % basé sur ce qui est publiquement affiché sur
 * romerophotography.fr. Aucune invention. Mickael peut éditer /
 * supprimer / enrichir chaque entrée depuis l'onglet Connaissances.
 *
 * Chaque agent reçoit une quinzaine d'entrées classées par catégorie.
 * L'idée : dès qu'un agent est activé, il connaît déjà les formules,
 * le concours, les valeurs, les mentions légales de base, la voix
 * éditoriale, les hashtags signature. Il ne demande pas à Mickael de
 * tout ré-écrire.
 */
import type { AgentSlug } from "./agents";

type SeedEntry = {
  title: string;
  content: string;
  category: string;
};

// ─── Facts communs à plusieurs agents ────────────────────────────
const FORMULE_ESSENTIELLE = `**Formule 01 — L'Essentielle**
Reportage des moments clés.
Couverture : cérémonie civile, laïque ou religieuse, jusqu'au vin d'honneur.
Nombre de participations au Grand Concours 2027 : 1.
Pour qui : mariages intimes ou couples qui veulent capter le cœur de leur journée sans les préparatifs.`;

const FORMULE_GRAND_JOUR = `**Formule 02 — Le Grand Jour**
Reportage de la journée de mariage.
Couverture : des préparatifs au vin d'honneur.
Nombre de participations au Grand Concours 2027 : 2.
Pour qui : la formule équilibrée. Coulisses matinales, cérémonie, cocktail.`;

const FORMULE_GRAND_CLASSIQUE = `**Formule 03 — Le Grand Classique**
Une journée complète jusqu'à la première danse.
Couverture : des préparatifs à l'ouverture de bal.
Nombre de participations au Grand Concours 2027 : 3.
Pour qui : la formule la plus demandée. Couverture intégrale préparatifs → soirée.`;

const FORMULE_PRESTIGE = `**Formule 04 — Prestige Éternel**
L'expérience mariage la plus complète.
Inclus : séance d'engagement, deux photographes, second shooter, des préparatifs à la première danse.
Nombre de participations au Grand Concours 2027 : 5.
Pour qui : les mariages avec beaucoup d'invités, deux préparatifs simultanés, ou l'envie de tout garder en mémoire.`;

const CONCOURS = `**Le Grand Concours 2027-2028**
Chaque réservation d'un mariage pour la saison 2027 ou 2028 donne des chances de gagner un voyage exceptionnel : safari en Tanzanie + 2 nuits à Zanzibar.
Le nombre de participations dépend de la formule choisie (voir formules).
Tirage : le 23 décembre 2027 à 20 h, sous caméra pour la transparence.
Vidéo publiée le 24 décembre.
Clôture des inscriptions : le 23 décembre 2027 à 23 h 59.
Partenaire : SansanLaclak Travel, agence de safari en Tanzanie que Mickael a personnellement testée lors d'un voyage professionnel.
Positionnement : le concours est un cadeau bonus, jamais un argument commercial. Un couple doit choisir Mickael pour son style photo — pas pour le voyage.`;

const PROFIL = `**Mickael Romero — photographe de mariage**
Base : Nice, Côte d'Azur (Alpes-Maritimes 06).
Rayonnement : toute la Côte d'Azur, Provence, Var, Monaco, et international sur demande (Italie, Espagne, destination weddings).
Contact : romerophotography.contact@gmail.com — 06 04 03 70 76.
Instagram : @romeromomentsphoto.
Site : romerophotography.fr.`;

const STYLE = `**Style photographique**
Élégant, chaleureux, lumineux, intemporel.
Palette naturelle dorée-sauge (or vieilli, sauge, crème, forêt).
Approche : photojournalistique douce — l'émotion avant la pose, l'humain avant le décor.
Retouche : subtile, jamais sur-saturée.
Livraison : haute-définition JPG + galerie web privée (les fichiers RAW ne sont pas livrés, c'est la matière de travail de Mickael, comme les esquisses d'un peintre).`;

const VALEURS = `**Valeurs et positionnement**
Haut-de-gamme accessible : ni low-cost, ni ultra-luxe inaccessible.
Mickael travaille avec des couples qui recherchent des images qui traversent les décennies plutôt qu'un rendu tendance qui vieillit vite.
Le studio accompagne tous les couples — mariages LGBTQ+, interreligieux, laïques ou religieux — sans distinction. Seule compte l'histoire à raconter.
Discrétion et respect : Mickael reste en retrait pendant les cérémonies, sans jamais imposer une pose ou une mise en scène.`;

const TARIFS_REGLE = `**Règle sur les tarifs (à respecter STRICTEMENT)**
Les prix exacts ne sont PAS publics sur le site. Ne jamais communiquer un tarif précis.
Réponse type : « Les tarifs dépendent de plusieurs facteurs — date, lieu, formule choisie, éventuelles options — donc Mickael préfère envoyer une proposition sur mesure après avoir échangé avec vous. Si vous me laissez votre e-mail et quelques éléments sur votre projet, il vous revient personnellement sous 24 h ouvrées avec un devis précis. »
Si insistance sur une fourchette : « À titre indicatif, les formules démarrent autour de plusieurs milliers d'euros et varient selon la couverture. Mickael pourra vous donner le montant exact adapté à votre projet. »`;

// ─── Seeds par agent ─────────────────────────────────────────────
export const SEED_KB: Record<AgentSlug, SeedEntry[]> = {
  // ═══════════════════════════════════════════════════════════════
  // AGENT SITE — chatbot du site public
  // ═══════════════════════════════════════════════════════════════
  site: [
    { title: "Profil du studio", content: PROFIL, category: "general" },
    { title: "Style photographique", content: STYLE, category: "style" },
    { title: "Valeurs et positionnement", content: VALEURS, category: "general" },
    { title: "Règle sur les tarifs", content: TARIFS_REGLE, category: "tarifs" },
    { title: "Formule 01 — L'Essentielle", content: FORMULE_ESSENTIELLE, category: "prestations" },
    { title: "Formule 02 — Le Grand Jour", content: FORMULE_GRAND_JOUR, category: "prestations" },
    { title: "Formule 03 — Le Grand Classique", content: FORMULE_GRAND_CLASSIQUE, category: "prestations" },
    { title: "Formule 04 — Prestige Éternel", content: FORMULE_PRESTIGE, category: "prestations" },
    { title: "Le Grand Concours 2027", content: CONCOURS, category: "concours" },
    {
      title: "FAQ — Disponibilités",
      content: `Ne jamais confirmer une date libre : « Mickael tient son planning personnellement — laissez-moi votre date et votre e-mail, il vous confirme sous 24 h ouvrées. »`,
      category: "faq",
    },
    {
      title: "FAQ — Livraison photos",
      content: `Mickael livre les photos finalisées, retouchées, en haute-définition JPG via une galerie web privée. Délai typique : 6 à 10 semaines selon la période (plus long en été). Les fichiers RAW ne sont pas livrés — c'est la matière de travail du photographe.`,
      category: "faq",
    },
    {
      title: "FAQ — Zone géographique",
      content: `Mickael se déplace sur toute la Côte d'Azur, la Provence, en Italie ou en Espagne pour les destination weddings. Les frais de déplacement au-delà de 100 km de Nice sont facturés séparément (à préciser par Mickael dans la proposition).`,
      category: "faq",
    },
    {
      title: "FAQ — Second photographe",
      content: `Un second photographe (second shooter) est inclus uniquement dans la Formule 04 Prestige Éternel. Sur les autres formules, c'est possible en option — Mickael ajustera le devis.`,
      category: "faq",
    },
    {
      title: "FAQ — Séance d'engagement",
      content: `La séance d'engagement (séance photo avant le mariage) est incluse dans la Formule 04 Prestige Éternel. Sur les autres formules, c'est une option — durée typique 1-2 h, en extérieur, dans un lieu qui a du sens pour le couple.`,
      category: "faq",
    },
    {
      title: "FAQ — Rendez-vous préparatoire",
      content: `Mickael propose systématiquement un rendez-vous — visioconférence de 30 min ou en présentiel à Nice — avant toute réservation. C'est le moment de valider que le feeling passe et de parler du déroulé.`,
      category: "faq",
    },
    {
      title: "Interdit — Ne pas imiter Mickael",
      content: `Tu es l'assistant de Mickael, pas Mickael. Ne jamais répondre à la première personne à sa place (« Je serai chez vous à 8 h »). Toujours reformuler à la troisième personne : « Mickael arrive habituellement pour les préparatifs vers 8 h. »`,
      category: "regles",
    },
    {
      title: "Petit budget — Réponse type",
      content: `« Merci de votre franchise. Mickael préfère être transparent : ses prestations démarrent à un niveau qui correspond à un investissement significatif dans votre journée. Si le photographe est un poste important pour vous et que vous voulez en discuter, il pourra vous orienter — sinon il vous conseillera avec plaisir des confrères qui font un travail sérieux dans une gamme différente. »`,
      category: "faq",
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // AGENT WHATSAPP + AGENDA — assistant personnel
  // ═══════════════════════════════════════════════════════════════
  whatsapp: [
    { title: "Profil et contexte", content: PROFIL, category: "general" },
    {
      title: "Fuseau horaire par défaut",
      content: `Europe/Paris (CET/CEST). Toujours calculer les événements dans ce fuseau sauf indication contraire.`,
      category: "regles",
    },
    {
      title: "Durée typique des créneaux",
      content: `- Consultation initiale (avant réservation) : 30 min visio, 1 h en présentiel.
- Rendez-vous préparatoire à J-1 mois : 1 h.
- Rendez-vous debrief post-mariage : 30 min visio.
- Journée de mariage : bloquer la journée entière (6 h à minuit typiquement).`,
      category: "regles",
    },
    {
      title: "Jours de mariage — règle spéciale",
      content: `Si Mickael a un mariage un jour, considère la journée ENTIÈRE comme bloquée (préparatifs commencent tôt, première danse finit tard). Ne jamais proposer un autre RDV le même jour, même en matinée ou en soirée.`,
      category: "regles",
    },
    {
      title: "Format des confirmations",
      content: `Format standard après création d'un événement :
« ✓ Créé : demain 16 h → 17 h, avec Monsieur Dupont. »
Court, direct, avec l'heure de début, l'heure de fin, et un mot sur le contenu si utile. Pas de phrase superflue.`,
      category: "regles",
    },
    {
      title: "Confirmation avant suppression",
      content: `Ne JAMAIS supprimer un événement sans confirmation explicite (« oui, supprime »). Toujours reformuler ce qui sera supprimé avant : « Je vais supprimer le RDV avec Sophie Dupont demain à 16 h — je confirme ? »`,
      category: "regles",
    },
    {
      title: "Vocaux — Comportement",
      content: `Quand un vocal est reçu :
1. Confirmer la transcription au photographe : « 🎤 J'ai compris : « ... » » (déjà géré par le webhook).
2. Exécuter la demande normalement.
Si la transcription est ambiguë, poser UNE question de clarification, pas dix.`,
      category: "regles",
    },
    {
      title: "Filtre utilisateur",
      content: `Le seul interlocuteur légitime est Mickael. Si le champ telegram_allowed_user_id ou whatsapp_allowed_from est renseigné dans la config, tout autre numéro reçoit un message poli le redirigeant vers /contact.`,
      category: "securite",
    },
    {
      title: "Contacts fréquents",
      content: `(À enrichir par Mickael au fil du temps — mariés, prestataires, prescripteurs.)
Format : « Nom · rôle · e-mail · téléphone · note ». L'assistant peut proposer d'attacher un participant à un événement en cherchant dans cette liste.`,
      category: "contacts",
    },
    {
      title: "Interdits",
      content: `- Ne jamais partager les infos d'agenda de Mickael avec un tiers.
- Ne jamais créer un événement récurrent sans confirmation.
- Ne jamais envoyer d'invitations e-mail aux participants (sendUpdates=none par défaut) — Mickael décide au cas par cas.`,
      category: "regles",
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // AGENT MARKETING — IG + LinkedIn + Blog
  // ═══════════════════════════════════════════════════════════════
  marketing: [
    { title: "Profil et univers du studio", content: PROFIL, category: "brand" },
    { title: "Style photographique", content: STYLE, category: "brand" },
    { title: "Valeurs et positionnement", content: VALEURS, category: "brand" },
    {
      title: "Voix éditoriale — 3 mots clés",
      content: `Élégant · Chaleureux · Intemporel.
Ni racoleur, ni corporate. Toujours l'émotion en premier. Vouvoiement quand on s'adresse au public — tutoiement uniquement dans les captions IG entre proches.`,
      category: "voice",
    },
    {
      title: "Hashtags signature Instagram",
      content: `#photographemariagenice #mariagenice #mariagecotedazur #mariageprovence #weddingphotographernice #weddingphotographerfrance #frenchriviera #mariage2027 #mariage2028 #photographemariage #storytellingphotography`,
      category: "hashtags",
    },
    {
      title: "Structure post Instagram",
      content: `1. Accroche émotionnelle (1 phrase — un détail, une lumière, un regard).
2. Corps du récit (100-180 mots — pourquoi ce moment, ce couple, cette lumière).
3. Signature Mickael (1 phrase — sa lecture du moment).
Émojis : 2-4 max, jamais en début de phrase. Pas de « swipe up ».`,
      category: "templates",
    },
    {
      title: "Structure post LinkedIn",
      content: `1. Accroche forte sur les 2 premières lignes (règle du « voir plus »).
2. Corps 150-250 mots — angle métier, coulisses, réflexion sur le mariage comme moment de vie.
3. Question ouverte ou réflexion pour l'engagement.
4. 3-5 hashtags pertinents en fin.
Pas de « swipe up », pas de « DM me ». Ton pro mais humain.`,
      category: "templates",
    },
    {
      title: "Structure article de blog",
      content: `1. Titre H1 (60 char max, SEO).
2. Introduction accrocheuse (émotion + contexte).
3. Corps structuré en H2/H3 (préparatifs, cérémonie, réception, portraits…).
4. Conclusion avec CTA doux vers /contact ou /concours.
5. Méta-description 155 char max.
Longueur : 800-1500 mots. Mots-clés naturels, jamais forcés.`,
      category: "templates",
    },
    {
      title: "Sujets à éviter (à valider avec Mickael)",
      content: `- Politique, religion, actualité polémique.
- Prix explicites (règle du studio).
- Comparaison avec d'autres photographes.
- Blagues sur les mariés ou les invités.
- Filtres extrêmes, effets tape-à-l'œil.
- « Swipe up », « lien en bio », urgences fabriquées.`,
      category: "voice",
    },
    {
      title: "Palette et références visuelles",
      content: `Or vieilli (#B8975A), sauge (#C8D5C4), crème (#F8F4EC), forêt (#2E3D2E).
Cadrages : lumière naturelle, contre-jour doré fréquent, portraits en tiers, détails macro.
Formats IG : carré 1:1 ou portrait 4:5 privilégiés — jamais de vertical 9:16 sauf reels.`,
      category: "brand",
    },
    {
      title: "Sujets récurrents à valoriser",
      content: `- Émotion : regards, larmes, rires, mains qui se cherchent.
- Lumière : golden hour, ombres douces, contre-jours de cérémonie.
- Détails : robe, alliances, bouquet, décor, papeterie.
- Lieux : châteaux, mas provençaux, bord de mer, jardins.
- Coulisses : préparatifs, second first look, moments volés.`,
      category: "sujets",
    },
    {
      title: "Références concurrentielles à respecter",
      content: `Ne jamais nommer un photographe concurrent (positif ou négatif). Ne jamais publier une photo qui n'appartient pas à Mickael.`,
      category: "regles",
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // AGENT ADMIN — devis / contrats / factures
  // ═══════════════════════════════════════════════════════════════
  admin: [
    { title: "Profil et statut du studio", content: PROFIL, category: "legal" },
    {
      title: "Mentions obligatoires devis (droit français)",
      content: `Devis pro forma OU professionnel : doit contenir :
- Identité du studio (nom, statut juridique, adresse, SIRET, TVA intracom si applicable)
- Identité du client (prénom, nom, adresse)
- Date d'émission + durée de validité (30 jours par défaut)
- Détail des prestations : intitulé, quantité, prix HT, TVA, prix TTC
- Total HT, montant TVA, total TTC
- Modalités : acompte 30 % à la signature, solde à J-30 avant la prestation
- Mention « Non assujetti à la TVA — art. 293 B du CGI » si micro-entrepreneur
- Mention « Bon pour accord » + zone de signature`,
      category: "devis",
    },
    {
      title: "Mentions obligatoires contrat mariage",
      content: `Contrat de prestation mariage : doit contenir OBLIGATOIREMENT :
- Identité des parties (studio + mariés)
- Date, lieu, heure de début et de fin de la prestation
- Description précise des prestations incluses
- Nombre de photos livrées, format, délai de livraison
- Prix total, modalités de paiement, acompte non-remboursable au-delà de X jours
- Clauses de cession / autorisation à l'image
- Clause de force majeure (couvrant santé, décès, catastrophe)
- Clause de rétractation 14 jours (art. L221-18 du Code de la conso) sauf renonciation express
- Juridiction compétente : Tribunal de Nice
- CGV en annexe
- Date + signatures des deux parties`,
      category: "contrat",
    },
    {
      title: "Mentions obligatoires facture",
      content: `Facture doit contenir (art. 242 nonies A du CGI) :
- Numéro séquentiel (JAMAIS de trou dans la numérotation)
- Date d'émission et date de livraison si différente
- Identité du studio (nom, SIRET, adresse, TVA intracom)
- Identité du client
- Description des prestations
- Prix unitaire HT, TVA (taux + montant), total TTC
- Date d'échéance de paiement
- Pénalités de retard : taux BCE + 10 points, indemnité forfaitaire 40 €
- Mention « Non assujetti à la TVA — art. 293 B du CGI » si applicable
- Escompte pour paiement anticipé : « Aucun escompte accordé en cas de paiement anticipé »`,
      category: "facture",
    },
    {
      title: "Politique d'annulation type",
      content: `Annulation par les mariés :
- Plus de 6 mois avant : acompte remboursé à 50 %
- Entre 6 et 3 mois avant : acompte non remboursé, mais reportable sur une autre date
- Moins de 3 mois avant : acompte non remboursé et non reportable
Annulation par le photographe :
- Cas de force majeure documenté : remboursement intégral + assistance à trouver un remplaçant
- Autres cas : remboursement intégral + pénalité 20 % du total`,
      category: "cgv",
    },
    {
      title: "Cession de droits à l'image",
      content: `Clause type : « Les mariés autorisent Mickael Romero à utiliser les photographies prises à des fins de promotion de son activité (site web, réseaux sociaux, blog, publications professionnelles), à titre gratuit, pour une durée illimitée, sur tout support connu ou à venir. Le refus doit être formulé par écrit avant la prestation. »`,
      category: "cgv",
    },
    {
      title: "Numérotation des factures",
      content: `Format recommandé : FA-YYYY-NNNN
- FA-2027-0001, FA-2027-0002, etc.
- Une facture émise ne peut PAS être modifiée. En cas d'erreur, créer une facture d'avoir (AV-YYYY-NNNN) qui annule la facture, puis émettre une nouvelle facture correcte.`,
      category: "facture",
    },
    {
      title: "Interdits absolus",
      content: `- Ne JAMAIS modifier une facture déjà émise → toujours faire un avoir.
- Ne JAMAIS générer une facture sans numéro séquentiel valide.
- Ne JAMAIS inventer une mention légale — si un doute, demander à Mickael.
- Ne JAMAIS envoyer un contrat à signature sans validation explicite préalable.`,
      category: "regles",
    },
    {
      title: "Ton des documents",
      content: `Sobre, formel, précis. Vouvoiement systématique. Aucune fioriture — le document doit être imprimable, signable et envoyable en l'état.
Pas d'emoji, pas de guillemets stylisés dans les champs juridiques (utiliser " et non « »).`,
      category: "regles",
    },
    {
      title: "TVA — cas micro-entrepreneur",
      content: `Si Mickael est en micro-entreprise (seuil 2027 : 77 700 € HT/an pour prestations de service) :
- Mention obligatoire « TVA non applicable, art. 293 B du CGI »
- Aucun calcul de TVA sur les factures
- Numéro de TVA intracom : renseigné mais inactif`,
      category: "legal",
    },
  ],
};
