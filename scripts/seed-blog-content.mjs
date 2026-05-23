#!/usr/bin/env node
/**
 * Seed real, rich-text content for the 6 demo blog posts (FR + EN).
 * Run with: node scripts/seed-blog-content.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "romero.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = DELETE");

const CONTENT = {
  "5-lieux-secrets-cote-azur": {
    title_fr: "5 lieux secrets pour se marier sur la Côte d'Azur",
    title_en: "5 secret venues to marry on the French Riviera",
    excerpt_fr: "Au-delà des classiques, voici cinq adresses confidentielles pour un mariage hors du temps — d'une chapelle perchée dans l'arrière-pays niçois aux jardins privés du Cap d'Antibes.",
    excerpt_en: "Beyond the classics, five confidential addresses for a timeless wedding — from a chapel perched in the Nice hinterland to the private gardens of Cap d'Antibes.",
    body_fr: `<p>La Côte d'Azur regorge de lieux d'exception — mais les plus beaux ne sont pas toujours ceux qu'on voit dans les magazines. Après dix ans à photographier des mariages dans la région, voici cinq adresses que je garde précieusement et que je partage aujourd'hui avec vous.</p>

<h2>1. La Chapelle Saint-Pierre, Èze-Village</h2>
<p>Perchée à 429 mètres au-dessus de la Méditerranée, cette petite chapelle du XIVᵉ siècle accueille jusqu'à 60 invités. Le contraste entre les vieilles pierres et la vue panoramique sur le Cap Ferrat est saisissant. Mon conseil : prévoyez la cérémonie en fin d'après-midi pour profiter de la lumière dorée sur les ruines du château voisin.</p>

<blockquote>« La cérémonie d'Anastasia et Jordan s'est tenue ici l'an dernier — le mistral a même cessé pendant les vœux. »</blockquote>

<h3>Capacité &amp; budget</h3>
<ul>
  <li>60 invités maximum dans la chapelle</li>
  <li>Location à partir de 1 800 € la journée</li>
  <li>Accès véhicule restreint — prévoir un service de navettes</li>
</ul>

<h2>2. Le Domaine du Mas de Pierre, Saint-Paul-de-Vence</h2>
<p>Cinq hectares de pinède et d'oliviers centenaires, une chapelle privée, une orangeraie où dîner sous les étoiles. Le domaine accueille jusqu'à 150 invités et propose une gestion sur-mesure du jour J.</p>

<h2>3. La Villa Belle Vue, Beaulieu-sur-Mer</h2>
<p>Cette villa Belle Époque ouvre ses jardins privés pour des mariages confidentiels. La terrasse à colonnes face à la baie est mythique pour les photos de couple. Quatre suites permettent à la famille proche de loger sur place.</p>

<h2>4. Le Couvent des Minimes, Mane</h2>
<p>Un peu plus loin de la côte, au cœur du Pays de Forcalquier, ce couvent du XVIIᵉ siècle restauré offre 46 chambres et un jardin médiéval. Idéal pour un mariage long format sur trois jours.</p>

<h2>5. Cap d'Antibes Beach Hotel — plage privée</h2>
<p>Pour un mariage pieds dans le sable mais haut de gamme. La plage privée du Cap d'Antibes accueille jusqu'à 200 invités pour un dîner à la lueur des lampions et cocktail au coucher de soleil.</p>

<h3>Avant de réserver</h3>
<p>Tous ces lieux ont une chose en commun : ils se réservent <strong>12 à 18 mois à l'avance</strong> pour la haute saison (mai à septembre). Si votre date est flexible, octobre est devenu un mois magique sur la Côte — moins chaud, plus calme, et une lumière incomparable.</p>

<p>Vous avez un coup de cœur pour l'un de ces lieux ? <a href="/contact">Parlons de votre projet</a> — je connais bien la plupart de ces équipes et je peux vous mettre en relation.</p>`,
    body_en: `<p>The French Riviera is full of exceptional venues — but the most beautiful aren't always the ones you see in magazines. After ten years photographing weddings in the region, here are five addresses I keep close to my heart and share with you today.</p>

<h2>1. Saint-Pierre Chapel, Èze-Village</h2>
<p>Perched 429 metres above the Mediterranean, this small 14th-century chapel hosts up to 60 guests. The contrast between the old stones and the panoramic view of Cap Ferrat is breathtaking. My tip: hold the ceremony in late afternoon to enjoy the golden light on the neighbouring castle ruins.</p>

<blockquote>« Anastasia and Jordan's ceremony took place here last year — even the mistral stopped during the vows. »</blockquote>

<h2>2. Domaine du Mas de Pierre, Saint-Paul-de-Vence</h2>
<p>Five hectares of pine forest and centuries-old olive trees, a private chapel, an orange grove for dinner under the stars. The estate accommodates up to 150 guests with bespoke wedding planning.</p>

<h2>3. Villa Belle Vue, Beaulieu-sur-Mer</h2>
<p>This Belle Époque villa opens its private gardens for confidential weddings. The columned terrace facing the bay is legendary for couple portraits. Four suites allow close family to stay on site.</p>

<h2>4. Couvent des Minimes, Mane</h2>
<p>A bit further from the coast, in the heart of Forcalquier country, this restored 17th-century convent offers 46 rooms and a medieval garden. Ideal for a long-format wedding spread over three days.</p>

<h2>5. Cap d'Antibes Beach Hotel — private beach</h2>
<p>For a feet-in-the-sand but high-end wedding. The private beach at Cap d'Antibes welcomes up to 200 guests for a lantern-lit dinner and sunset cocktails.</p>

<p>Drawn to one of these venues? <a href="/contact">Let's talk about your project</a> — I know most of these teams well and can put you in touch.</p>`,
  },

  "anastasia-jordan-eze": {
    title_fr: "Anastasia & Jordan — un mariage à Èze",
    title_en: "Anastasia & Jordan — a wedding in Èze",
    excerpt_fr: "Retour sur une journée suspendue entre ciel et Méditerranée. Le mistral, le voile, le coucher de soleil — toute l'histoire en 60 images.",
    excerpt_en: "A day suspended between sky and Mediterranean. The mistral, the veil, the sunset — the whole story in 60 images.",
    body_fr: `<p>Septembre dernier, Anastasia et Jordan m'ont fait l'honneur de capturer leur journée la plus importante. Direction Èze, ce village médiéval perché à 429 mètres au-dessus de la mer, pour une cérémonie laïque dans le jardin d'une villa privée taillée dans la pierre claire du Vieux Village.</p>

<h2>Le matin — préparatifs</h2>
<p>Anastasia s'est préparée dans la suite parentale d'une maison familiale à Beaulieu. Sa mère ajustait la traîne en murmurant des histoires d'enfance, ses sœurs riaient nerveusement, et le bouquet — pivoines, roses anciennes, eucalyptus — attendait sagement sur le rebord de la fenêtre.</p>

<p>De son côté, Jordan finissait de nouer sa cravate dans le salon, entouré de ses témoins. Pas de stress visible, juste cette concentration calme qu'on lit chez les gens qui savent <em>exactement</em> ce qu'ils sont en train de faire.</p>

<h2>La cérémonie</h2>
<p>16h47. Le mistral, qu'on espérait calmé pour l'occasion, soulevait le voile d'Anastasia à chaque pas. Loin d'être gênant, c'est devenu la signature visuelle de la journée. Sur les photos, on voit ce voile danser dans toutes les directions — comme si l'instant lui-même refusait de se figer.</p>

<blockquote>« Si tu me regardes encore comme ça dans cinquante ans, j'aurai eu la vie la plus belle. » — Anastasia, lors des vœux.</blockquote>

<h3>Le coucher de soleil</h3>
<p>Vers 19h30, alors que les invités passaient au cocktail, j'ai emmené Anastasia et Jordan vers le sentier qui surplombe la villa. Vingt minutes, juste eux deux, le silence et la lumière. C'est dans ces moments-là, loin du protocole, qu'on capte les images les plus vraies.</p>

<h2>La soirée</h2>
<p>Dîner sous les oliviers, premiers discours, la mariée qui rit aux larmes en écoutant son frère. Puis la première danse — Sade, "By Your Side", choisi des mois à l'avance — et la piste qui s'est lentement remplie jusqu'à se vider au petit matin.</p>

<h3>Le matériel</h3>
<ul>
  <li>Sony A7 IV + Sigma 35mm f/1.4 ART (l'objectif que je ne quitte jamais en cérémonie)</li>
  <li>Sony A7 III + 85mm f/1.8 (portraits couple)</li>
  <li>Profoto B10 pour les portraits de nuit</li>
</ul>

<p>La galerie complète d'Anastasia & Jordan est <a href="/portfolio/anastasia-jordan">visible sur le portfolio</a>.</p>`,
    body_en: `<p>Last September, Anastasia and Jordan gave me the honour of capturing their most important day. Off to Èze, the medieval village perched 429 metres above the sea, for a civil ceremony in the garden of a private villa carved into the pale stone of the Old Town.</p>

<h2>The morning — getting ready</h2>
<p>Anastasia got ready in the parental suite of a family home in Beaulieu. Her mother adjusted the train while murmuring childhood stories, her sisters laughed nervously, and the bouquet — peonies, antique roses, eucalyptus — waited quietly on the window sill.</p>

<h2>The ceremony</h2>
<p>4:47pm. The mistral, which we had hoped would calm for the occasion, kept lifting Anastasia's veil with every step. Far from being annoying, it became the visual signature of the day.</p>

<blockquote>« If you still look at me like this in fifty years, I'll have had the most beautiful life. » — Anastasia, during the vows.</blockquote>

<p>The full Anastasia & Jordan gallery is <a href="/portfolio/anastasia-jordan">visible on the portfolio</a>.</p>`,
  },

  "choisir-photographe-mariage": {
    title_fr: "Comment choisir son photographe de mariage",
    title_en: "How to choose your wedding photographer",
    excerpt_fr: "Style, prix, feeling, livrables : le guide honnête pour ne pas se tromper, écrit par un photographe qui a vu beaucoup d'erreurs (et quelques merveilles).",
    excerpt_en: "Style, price, vibe, deliverables: the honest guide to not getting it wrong, written by a photographer who's seen many mistakes (and a few marvels).",
    body_fr: `<p>Choisir son photographe de mariage est l'une des décisions les plus importantes de votre organisation. Pas parce que la photo serait <em>la</em> chose la plus importante — votre journée, c'est avant tout vous, vos proches, votre histoire — mais parce que c'est tout ce qu'il vous restera de tangible quand la fête sera finie.</p>

<p>Voici les questions que je conseille à tous les couples qui me contactent, qu'ils me choisissent ou non.</p>

<h2>1. Le style avant tout</h2>
<p>Reportage spontané, posé éditorial, fine art, sombre &amp; intime, lumineux &amp; aérien… Chaque photographe a une <strong>signature</strong>. Avant de regarder les prix, regardez 3 ou 4 reportages complets (pas juste les "best of") de chaque candidat. Demandez-vous : <em>est-ce que ces photos me ressemblent ?</em></p>

<h3>Comment lire un portfolio</h3>
<ul>
  <li>Les photos d'invités sont-elles aussi belles que celles des mariés ?</li>
  <li>Les lumières difficiles (église sombre, soirée) sont-elles bien gérées ?</li>
  <li>Les visages sont-ils naturels, ou tout le monde a-t-il l'air <em>posé</em> ?</li>
  <li>Y a-t-il des émotions vraies, ou juste des sourires de façade ?</li>
</ul>

<h2>2. Le feeling humain</h2>
<p>Vous allez passer 10 à 14 heures avec cette personne le jour J. Si le premier appel vous laisse une impression bizarre, fuyez. Un bon photographe doit vous mettre à l'aise dès la première conversation.</p>

<blockquote>« Le meilleur photographe pour vous, c'est celui qu'on oubliera presque sur les photos — parce qu'il était partout, mais sans jamais peser. »</blockquote>

<h2>3. Les livrables</h2>
<p>Demandez TOUJOURS, par écrit :</p>
<ul>
  <li>Combien de photos retouchées finales ? (compte attendu : 400-800 pour une journée complète)</li>
  <li>En combien de temps après le mariage ?</li>
  <li>Galerie en ligne ? Téléchargement haute définition ?</li>
  <li>Album papier en option ? Si oui, qui le fabrique ?</li>
  <li>Droits d'usage : pouvez-vous tout imprimer ? Tout partager ?</li>
</ul>

<h2>4. Le prix</h2>
<p>En France, un reportage complet de qualité se situe entre <strong>1 800 € et 3 500 €</strong>. En dessous, méfiez-vous (souvent un débutant, ou des coupes sur la postproduction). Au-dessus, vous payez la notoriété — pas forcément la qualité.</p>

<h3>Le contrat</h3>
<p>Aucun photographe sérieux ne travaille sans contrat. Le vôtre doit préciser : horaires, lieux, livrables, modalités d'annulation, plan B en cas de maladie.</p>

<h2>5. La rencontre préalable</h2>
<p>Refusez les photographes qui ne veulent pas vous rencontrer avant. Une heure autour d'un café suffit à savoir si le feeling passe. Si géographiquement c'est impossible, un visio approfondi peut faire l'affaire — mais jamais juste un échange de mails.</p>

<p>Une question ? <a href="/contact">Écrivez-moi</a>, je réponds toujours sous 48 heures.</p>`,
    body_en: `<p>Choosing your wedding photographer is one of the most important decisions of your planning. Not because the photos would be <em>the</em> most important thing — your day is above all you, your loved ones, your story — but because it's all that will tangibly remain when the party is over.</p>

<h2>1. Style first</h2>
<p>Spontaneous reportage, editorial posed, fine art, dark &amp; intimate, bright &amp; airy… Every photographer has a <strong>signature</strong>. Before looking at prices, look at 3 or 4 full reportages (not just "best of") from each candidate.</p>

<h2>2. Human chemistry</h2>
<p>You'll spend 10-14 hours with this person on the day. If the first call leaves you with a strange feeling, run. A good photographer should put you at ease from the first conversation.</p>

<h2>3. Deliverables</h2>
<p>ALWAYS ask, in writing: how many final retouched photos? How long after the wedding? Online gallery? Print rights?</p>

<p>Got a question? <a href="/contact">Drop me a line</a>, I always reply within 48 hours.</p>`,
  },

  "heure-doree": {
    title_fr: "L'heure dorée : pourquoi tout le monde en parle",
    title_en: "Golden hour: why everyone is talking about it",
    excerpt_fr: "Cette lumière qui tombe une heure avant le coucher du soleil — comment la prévoir, comment l'attendre, et comment ne pas la rater.",
    excerpt_en: "That light that falls an hour before sunset — how to predict it, how to wait for it, and how not to miss it.",
    body_fr: `<p>Si vous avez déjà lu un magazine de mariage, vous avez entendu parler de l'<strong>heure dorée</strong>. C'est cette tranche d'environ 60 minutes juste avant le coucher du soleil où la lumière devient chaude, basse, douce, et magnifie absolument tout ce qu'elle touche. C'est le moment préféré de la plupart des photographes — et pour de bonnes raisons.</p>

<h2>Pourquoi cette lumière est-elle si spéciale ?</h2>
<p>Quand le soleil est haut dans le ciel (midi-15h), sa lumière traverse une fine couche d'atmosphère, reste blanche et tombe quasi à la verticale — ce qui crée des ombres dures sous les yeux, le menton, le nez. Pas idéal pour des portraits.</p>

<p>Pendant l'heure dorée, la lumière traverse beaucoup plus d'atmosphère (le soleil est rasant). Elle perd ses tons bleus, gagne en jaune et en orange, et arrive presque horizontalement. Résultat : pas d'ombres dures, des couleurs chaudes, un côté cinématographique inimitable.</p>

<blockquote>« Photographier un couple à l'heure dorée, c'est comme leur offrir un filtre Instagram naturel — sauf que personne n'a triché. »</blockquote>

<h2>Comment la prévoir</h2>
<p>Téléchargez l'application <strong>PhotoPills</strong> (payante mais incontournable) ou <strong>SunCalc</strong> (gratuit et web). Entrez le lieu du mariage et la date : vous verrez exactement à quelle heure le soleil se couche, et donc l'heure dorée (qui commence environ 60 minutes avant).</p>

<h3>Exemple — Nice, 15 août</h3>
<ul>
  <li>Coucher de soleil : 20h45</li>
  <li>Début de l'heure dorée : 19h45</li>
  <li>Pic de magie : 20h10 — 20h35</li>
</ul>

<h2>Comment ne pas la rater</h2>
<p>C'est là que ça coince souvent. L'heure dorée tombe pile au moment où votre cocktail bat son plein, où vos invités vous accaparent, où vous avez envie de boire un verre tranquille avec votre cousine que vous n'avez pas vue depuis 3 ans.</p>

<p>Mon conseil : <strong>bloquez 20 minutes</strong> dans votre planning, prévenez votre wedding planner, et faites confiance à votre photographe pour vous extraire au bon moment. Vingt minutes, c'est rien sur l'échelle de la journée. Mais ces 20 minutes vont produire 80% de vos photos préférées.</p>

<h2>Et s'il pleut ?</h2>
<p>Pas grave. Un ciel couvert donne une lumière diffuse magnifique, sans ombres, idéale pour les portraits. Le drame absolu pour un photographe de mariage, ce n'est pas la pluie : c'est le grand soleil de midi.</p>

<p><a href="/contact">Parlons-en</a> si vous voulez préparer ce moment ensemble dès vos repérages.</p>`,
    body_en: `<p>If you've ever read a wedding magazine, you've heard of the <strong>golden hour</strong>. It's that ~60-minute window just before sunset when the light becomes warm, low, soft, and magnifies absolutely everything it touches. It's most photographers' favourite moment — for good reasons.</p>

<h2>Why is this light so special?</h2>
<p>When the sun is high in the sky (noon-3pm), its light crosses a thin layer of atmosphere, stays white, and falls almost vertically — creating hard shadows under eyes, chin, nose. Not ideal for portraits.</p>

<p>During golden hour, light crosses much more atmosphere. It loses its blue tones, gains yellow and orange, and arrives almost horizontally. The result: no hard shadows, warm colours, an inimitable cinematic feel.</p>

<h2>How to plan for it</h2>
<p>Download the <strong>PhotoPills</strong> app or <strong>SunCalc</strong> (free, web). Enter the wedding location and date: you'll see exactly when the sun sets, and thus the golden hour (starts about 60 minutes before).</p>

<p><a href="/contact">Let's talk</a> if you want to prepare this moment together during your location scouting.</p>`,
  },

  "manon-kevin-saint-paul": {
    title_fr: "Manon & Kevin — Saint-Paul, intime",
    title_en: "Manon & Kevin — Saint-Paul, intimate",
    excerpt_fr: "Un mariage à cinquante invités dans les ruelles de Saint-Paul-de-Vence. Tables longues, tilleuls, mariée pieds nus.",
    excerpt_en: "A fifty-guest wedding in the alleys of Saint-Paul-de-Vence. Long tables, lime trees, barefoot bride.",
    body_fr: `<p>Juin 2025. Manon et Kevin voulaient un mariage à leur image : petit comité, beaucoup de simplicité, beaucoup d'amour. Pas de wedding planner, pas de plan de table imprimé sur du marbre — juste cinquante personnes qui comptent, dans un des plus beaux villages du monde.</p>

<h2>Le décor</h2>
<p>Saint-Paul-de-Vence un samedi en début d'été — autant dire un petit miracle d'avoir pu privatiser la place du jeu de boules pour le vin d'honneur. Les ruelles ocres, les bougainvilliers, les chats qui se laissent caresser : impossible de rater une seule photo dans ce village.</p>

<h2>La cérémonie</h2>
<p>Elle s'est tenue dans le jardin d'un mas familial à 2 km du village. Cérémonie laïque, présidée par l'oncle de Kevin (avocat de profession, qui s'est révélé être un orateur né). Les vœux ont été lus sous un grand olivier, avec en fond les cigales qui ont mis le temps avant de se taire pour écouter.</p>

<blockquote>« Tu es ma chance, mon repos, et la seule personne au monde devant qui je n'ai jamais peur d'avoir l'air ridicule. » — Kevin, lors de ses vœux.</blockquote>

<h2>Le dîner</h2>
<p>Tables longues installées sous les tilleuls de la cour. Nappes en lin écru, bougies plates, bouquets champêtres dans des bocaux de confiture. Le traiteur — un restaurateur d'Antibes que les mariés adoraient — a sorti un menu en cinq services qui a duré jusqu'au discours.</p>

<h3>Les détails que j'ai aimés</h3>
<ul>
  <li>Le menu calligraphié à la main par la maman de Manon</li>
  <li>Les cadeaux d'invités : petites bouteilles d'huile d'olive du domaine familial</li>
  <li>La playlist de la soirée, faite à 4 mains par les mariés pendant les 3 mois précédents</li>
  <li>Manon qui a dansé pieds nus dès la 2ᵉ chanson</li>
</ul>

<h2>Le moment que je n'oublierai pas</h2>
<p>Vers 23h, le père de Manon a sorti une guitare et a chanté une chanson qu'il avait écrite. Pas un grand musicien, mais une voix tremblée d'émotion. Tout le monde s'est arrêté de parler. Sa fille pleurait dans les bras de Kevin.</p>

<p>C'est <em>ça</em>, un mariage. Pas la déco, pas le menu, pas le DJ. Ça.</p>

<p>Vous voulez le même type d'ambiance pour le vôtre ? <a href="/contact">Écrivez-moi</a> — je connais bien Saint-Paul et ses environs.</p>`,
    body_en: `<p>June 2025. Manon and Kevin wanted a wedding in their image: small gathering, lots of simplicity, lots of love. No wedding planner, no seating chart printed on marble — just fifty people who matter, in one of the most beautiful villages in the world.</p>

<h2>The setting</h2>
<p>Saint-Paul-de-Vence on an early summer Saturday — quite a small miracle to have privatised the boules court for the cocktail. The ochre alleys, the bougainvilleas, the cats letting themselves be petted: impossible to miss a single photo in this village.</p>

<h2>The ceremony</h2>
<p>Held in the garden of a family mas 2km from the village. Civil ceremony, presided over by Kevin's uncle (a lawyer by trade, who turned out to be a born orator). The vows were read under a large olive tree.</p>

<blockquote>« You are my luck, my rest, and the only person in the world I'm never afraid to look ridiculous in front of. » — Kevin, during his vows.</blockquote>

<p>You want a similar atmosphere for yours? <a href="/contact">Drop me a line</a>.</p>`,
  },

  "domaine-de-la-tour": {
    title_fr: "Domaine de la Tour : visite guidée",
    title_en: "Domaine de la Tour: guided tour",
    excerpt_fr: "Trois hectares, deux oliveraies, une chapelle XVIIᵉ. Un repérage en images d'un domaine qui mérite votre attention.",
    excerpt_en: "Three hectares, two olive groves, a 17th-century chapel. A photo tour of an estate that deserves your attention.",
    body_fr: `<p>Caché à l'arrière de Grasse, le Domaine de la Tour est un petit secret bien gardé. Je l'ai découvert il y a deux ans en repérage pour un mariage qui finalement ne s'est pas fait là — mais j'ai gardé l'adresse précieusement. Depuis, j'y ai photographié trois mariages et je peux vous le recommander les yeux fermés.</p>

<h2>L'esprit du lieu</h2>
<p>Trois hectares de terrain en restanques, deux oliveraies anciennes (les arbres ont 400 ans pour les plus vieux), une chapelle privée du XVIIᵉ siècle restaurée avec respect, et une bastide provençale qui peut héberger 14 personnes sur place.</p>

<p>Tout est tenu par Élise et Marc, un couple d'anciens chefs qui ont quitté Paris il y a quinze ans pour racheter le domaine. C'est cette dimension humaine qui change tout — vous n'êtes pas dans une "structure", vous êtes chez quelqu'un.</p>

<h2>Le déroulé type</h2>
<h3>Cocktail</h3>
<p>Sur la grande terrasse devant la bastide, face aux oliveraies. Le coucher de soleil donne ici sur 180° de paysage — pas une route, pas une maison à l'horizon.</p>

<h3>Cérémonie</h3>
<p>Soit dans la chapelle (pour 80 invités max), soit en extérieur dans l'oliveraie haute. J'ai une préférence pour l'extérieur — la lumière qui filtre à travers les oliviers est juste magique.</p>

<h3>Dîner</h3>
<p>Sous une pergola en bois construite par Marc lui-même, avec des éclairages d'ambiance discrets. Capacité : 120 personnes confortablement, jusqu'à 160 en serrant.</p>

<h3>Soirée</h3>
<p>La grange aménagée à l'autre bout du domaine. Insonorisée — la fête peut durer jusqu'à 4h du matin sans déranger personne. Une vraie bénédiction.</p>

<h2>Côté logistique</h2>
<ul>
  <li><strong>Capacité</strong> : 120 invités confort, 160 max</li>
  <li><strong>Hébergement sur place</strong> : 14 personnes dans la bastide + 6 mobil-homes haut de gamme dans l'oliveraie basse</li>
  <li><strong>Tarif</strong> : 9 500 € la location 2 jours (vendredi soir au dimanche midi), repas non inclus</li>
  <li><strong>Traiteurs partenaires</strong> : 3 maisons recommandées, mais vous êtes libres d'amener qui vous voulez</li>
  <li><strong>Réservation</strong> : 14 à 18 mois à l'avance pour les samedis de mai-septembre</li>
</ul>

<h2>Les détails qui font la différence</h2>
<ul>
  <li>Une piscine à débordement (pour la photo du lendemain matin avec robe blanche dans l'eau — oui c'est devenu un classique)</li>
  <li>Un atelier de calligraphie sur place pour menus / faire-parts</li>
  <li>Un parking ombragé pour 80 voitures</li>
  <li>Une "petite église" pour les couples qui veulent une cérémonie religieuse — un prêtre local intervient régulièrement</li>
</ul>

<blockquote>« Le domaine n'est pas le plus instagrammable de la région, mais c'est de loin le plus chaleureux. Les invités se souviennent encore d'Élise qui leur servait le café du dimanche matin à 7h. »</blockquote>

<p>Pour un repérage ou des infos : <a href="https://www.domainedelatour.fr" target="_blank" rel="noopener noreferrer">leur site</a> ou je peux vous présenter à Élise et Marc directement. <a href="/contact">Contactez-moi</a>.</p>`,
    body_en: `<p>Hidden behind Grasse, Domaine de la Tour is a well-kept little secret. I discovered it two years ago while scouting for a wedding that ultimately didn't happen there — but I kept the address preciously. Since then, I've photographed three weddings there and can recommend it with my eyes closed.</p>

<h2>The spirit of the place</h2>
<p>Three hectares of terraced land, two ancient olive groves (the oldest trees are 400 years old), a private 17th-century chapel restored with respect, and a Provençal bastide that can house 14 people on site.</p>

<p>Everything is run by Élise and Marc, a couple of former chefs who left Paris fifteen years ago to buy back the estate. This human dimension changes everything — you're not in a "venue", you're at someone's home.</p>

<h2>Logistics</h2>
<ul>
  <li>Capacity: 120 guests comfortably, 160 max</li>
  <li>On-site accommodation: 14 people in the bastide</li>
  <li>Price: €9,500 for a 2-day rental</li>
  <li>Booking: 14-18 months ahead for May-September Saturdays</li>
</ul>

<p>For a tour or info: <a href="/contact">Contact me</a>, I can introduce you to Élise and Marc directly.</p>`,
  },
};

const upd = db.prepare(`
  UPDATE posts SET title_fr = ?, title_en = ?, excerpt_fr = ?, excerpt_en = ?, body_fr = ?, body_en = ?
  WHERE slug = ?
`);

let updated = 0;
for (const [slug, c] of Object.entries(CONTENT)) {
  const r = upd.run(c.title_fr, c.title_en, c.excerpt_fr, c.excerpt_en, c.body_fr, c.body_en, slug);
  if (r.changes > 0) {
    console.log(`✓ ${slug} (${c.body_fr.length} chars FR, ${c.body_en.length} chars EN)`);
    updated++;
  } else {
    console.log(`⚠ ${slug} not found in DB`);
  }
}

console.log(`\nUpdated ${updated} post(s).`);
db.pragma("wal_checkpoint(TRUNCATE)");
db.close();
