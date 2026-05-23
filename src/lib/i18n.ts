export type Lang = "fr" | "en";

export type Strings = {
  nav: { home: string; about: string; services: string; portfolio: string; blog: string; reviews: string; contact: string };
  book: string;
  tagline: string;
  home: {
    eyebrow: string; locale: string;
    title1: string; title2: string; sub: string; cta: string;
    valuesEyebrow: string; valuesTitle: string;
    values: [string, string][];
    featuredEyebrow: string; featuredTitle: string; featuredCta: string;
    bandQuote: string; bandAttr: string;
  };
  about: {
    eyebrow: string; title: string; titleAccent: string; lead: string;
    bodyEyebrow: string; bodyTitle: string; body: string[];
    valuesEyebrow: string; valuesTitle: string; values: [string, string][];
    processEyebrow: string; processTitle: string; process: [string, string][];
    gearEyebrow: string; gearTitle: string; gear: string[];
    gearLead: string;
  };
  services: {
    eyebrow: string; title: string; titleAccent: string; lead: string;
    cards: [string, string, string, string][];
    zoomEyebrow: string; zoomTitle: string; zoomIntro: string;
    includes: [string, string][];
    galleryEyebrow: string; cta: string;
  };
  portfolio: {
    eyebrow: string; title: string; titleAccent: string; lead: string;
    filters: string[];
    backToPortfolio: string; seeFull: string;
    caseEyebrow: string; caseStory: string;
  };
  reviews: {
    eyebrow: string; title: string; titleAccent: string; lead: string;
    googleCta: string;
    stats: [string, string][];
    live: string; liveTitle: string;
  };
  blog: {
    eyebrow: string; title: string; titleAccent: string; lead: string;
    readMore: string; categories: string[]; featured: string;
  };
  contact: {
    eyebrow: string; title: string; titleAccent: string; lead: string;
    form: {
      firstName: string; lastName: string; email: string; phone: string;
      date: string; place: string; message: string; messagePh: string;
      submit: string; sent: string; error: string;
    };
    coordsEyebrow: string; coordsTitle: string;
    coords: [string, string, string][];
    socialEyebrow: string; followInstagram: string; followPinterest: string;
  };
  cta: { question: string; line1: string; line2: string };
  footer: {
    tagline: string; explore: string; contactCol: string;
    legal: string; privacy: string; copy: string; crafted: string;
  };
};

export const STRINGS: Record<Lang, Strings> = {
  fr: {
    nav: { home: "ACCUEIL", about: "À PROPOS", services: "PRESTATIONS", portfolio: "PORTFOLIO", blog: "BLOG", reviews: "AVIS", contact: "CONTACT" },
    book: "RÉSERVER UNE SÉANCE",
    tagline: "L'art de capturer vos émotions",

    home: {
      eyebrow: "PHOTOGRAPHE DE MARIAGE — NICE & AU-DELÀ",
      locale: "Nice · Côte d'Azur · Worldwide",
      title1: "Chaque instant raconte",
      title2: "votre histoire",
      sub: "Romero Photography immortalise vos plus beaux moments avec sensibilité, élégance et une touche intemporelle.",
      cta: "DÉCOUVRIR MON UNIVERS",
      valuesEyebrow: "MA PROMESSE",
      valuesTitle: "Quatre piliers, une signature",
      values: [
        ["AUTHENTICITÉ", "Capturer l'émotion vraie, sans artifice."],
        ["ÉLÉGANCE", "Une esthétique raffinée et intemporelle."],
        ["PROXIMITÉ", "Un accompagnement humain et chaleureux."],
        ["EXCELLENCE", "Un rendu haut de gamme à la hauteur de votre jour J."]
      ],
      featuredEyebrow: "DERNIERS MARIAGES",
      featuredTitle: "Histoires récemment écrites",
      featuredCta: "VOIR TOUT LE PORTFOLIO",
      bandQuote: "« Mickael a saisi des moments que nous n'avions même pas vus. Chaque image est un souvenir vivant. »",
      bandAttr: "— Anastasia & Jordan, mariage à Èze"
    },

    about: {
      eyebrow: "À PROPOS",
      title: "Une passion, un regard,",
      titleAccent: "une signature",
      lead: "Mickael Romero photographie les mariages comme on raconte une histoire — avec patience, avec tendresse, et avec ce regard qui sait reconnaître l'instant juste.",
      bodyEyebrow: "NOTRE HISTOIRE",
      bodyTitle: "L'art de figer l'éphémère",
      body: [
        "Né sur la Côte d'Azur, Mickael a fait de la lumière méditerranéenne sa première complice. Après dix ans à explorer le portrait et le reportage, il consacre désormais son objectif aux mariages — ces journées où chaque seconde devient mémoire.",
        "Son approche ? Discrète, attentive, profondément humaine. Il ne dirige pas, il accompagne. Il ne pose pas, il écoute. Et c'est dans cette écoute que naissent les images les plus sincères.",
        "Chaque mariage est unique, chaque couple a sa langue. Mickael apprend la vôtre avant de photographier — pour que vos images ressemblent à ce que vous êtes, pas à ce qu'on attend de vous."
      ],
      valuesEyebrow: "MES VALEURS",
      valuesTitle: "Ce qui guide chaque cliché",
      values: [
        ["EXCELLENCE", "Un rendu haut de gamme, du premier brief à la livraison."],
        ["SENS DU DÉTAIL", "Chaque clin d'œil, chaque main qui tremble, capturé."],
        ["ÉMOTION", "L'instant vrai prime sur l'image parfaite."],
        ["ÉLÉGANCE", "Une esthétique douce, lumineuse, intemporelle."]
      ],
      processEyebrow: "MON PROCESSUS",
      processTitle: "Un accompagnement sur-mesure",
      process: [
        ["RENCONTRE & ÉCOUTE", "On échange autour d'un café — votre histoire, votre vision, ce qui vous fait vibrer."],
        ["PRÉPARATION", "Repérage des lieux, planning détaillé, ajustements sur-mesure jusqu'au jour J."],
        ["JOUR J", "Une présence discrète et bienveillante, du premier rayon au dernier slow."],
        ["LIVRAISON", "Vos souvenirs sublimés, livrés en galerie privée et en album papier."]
      ],
      gearEyebrow: "ÉQUIPEMENT",
      gearTitle: "Des outils au service de l'instant",
      gearLead: "Un équipement choisi avec soin — silencieux, lumineux, fidèle. Mais l'outil ne fait pas l'image. Le regard, lui, ne s'achète pas.",
      gear: ["Sony A7 IV — boîtier principal", "Sony A7 III — second boîtier", "Sigma 35mm f/1.4 ART", "85mm f/1.8 portrait", "16-35mm f/2.8 grand-angle", "Profoto B10 — éclairage portable"]
    },

    services: {
      eyebrow: "PRESTATIONS",
      title: "Des images pensées dans les",
      titleAccent: "moindres détails",
      lead: "Trois formules, une exigence : que chaque image vous ressemble, et que chaque souvenir vous accompagne longtemps.",
      cards: [
        ["REPORTAGE COMPLET MARIAGE", "De la préparation à l'ouverture de bal", "À partir de 2 400 €", "Couverture intégrale de votre journée, des préparatifs jusqu'à la première danse. Galerie privée en ligne, retouches professionnelles, album papier en option."],
        ["SÉANCE COUPLE / ENGAGEMENT", "Une parenthèse intime avant le grand jour", "À partir de 480 €", "Une heure et demie en duo, en bord de mer ou dans un lieu qui vous est cher. Idéal pour apprivoiser l'objectif avant le mariage."],
        ["ÉVÉNEMENTS PRIVÉS", "Anniversaires, baptêmes, fiançailles", "Sur devis", "Une présence sensible pour vos célébrations familiales — fêtes intimistes, vins d'honneur, anniversaires marquants."]
      ],
      zoomEyebrow: "ZOOM SUR",
      zoomTitle: "Le reportage complet, en détail",
      zoomIntro: "Une journée, une histoire, un livre d'images. Voici ce qui est inclus dans chaque reportage complet.",
      includes: [
        ["Préparatifs des mariés", "Robe, costume, derniers regards — l'attente, la tendresse, les fous rires."],
        ["Cérémonie civile et/ou religieuse", "Tous les regards, toutes les mains, tous les serments."],
        ["Cocktail & vin d'honneur", "Vos proches, leurs sourires, l'ambiance qui s'installe."],
        ["Repas & soirée", "Discours, premières danses, fous rires sur la piste — jusqu'au bout de la nuit."],
        ["Galerie privée en ligne", "Vos images livrées sous 4 semaines, accessibles à vie, partageables."],
        ["Retouches professionnelles", "Chaque cliché sélectionné, retravaillé en couleur et en lumière."]
      ],
      galleryEyebrow: "QUELQUES IMAGES",
      cta: "PARLONS DE VOTRE PROJET"
    },

    portfolio: {
      eyebrow: "PORTFOLIO MARIAGE",
      title: "Des histoires d'amour",
      titleAccent: "immortalisées",
      lead: "Découvrez les mariages que j'ai eu l'honneur de photographier — chacun unique, chacun précieux.",
      filters: ["TOUS", "FRANCE", "INTERNATIONAL", "INTIMISTE"],
      backToPortfolio: "← RETOUR AU PORTFOLIO",
      seeFull: "VOIR LA GALERIE",
      caseEyebrow: "MARIAGE",
      caseStory: "L'histoire en quelques mots"
    },

    reviews: {
      eyebrow: "AVIS CLIENTS",
      title: "Ils m'ont fait",
      titleAccent: "confiance",
      lead: "Chaque mariage est une rencontre. Voici ce que mes mariés en ont retenu.",
      googleCta: "VOIR TOUS LES AVIS SUR GOOGLE",
      stats: [["5,0", "NOTE GOOGLE"], ["87", "AVIS CLIENTS"], ["120+", "MARIAGES IMMORTALISÉS"]],
      live: "EN DIRECT DE GOOGLE",
      liveTitle: "Ils ont vécu l'expérience"
    },

    blog: {
      eyebrow: "JOURNAL",
      title: "Carnets de la",
      titleAccent: "Riviera",
      lead: "Conseils pour les futurs mariés, lieux de rêve sur la Côte d'Azur, coulisses de mariages — un journal pour rêver, préparer, s'inspirer.",
      readMore: "LIRE L'ARTICLE",
      categories: ["TOUS", "MARIAGES", "LIEUX", "CONSEILS"],
      featured: "À LA UNE"
    },

    contact: {
      eyebrow: "PRENONS CONTACT",
      title: "Votre histoire mérite",
      titleAccent: "d'être racontée",
      lead: "Parlez-moi de votre projet — date, lieu, ambiance — et je reviens vers vous sous 48 heures.",
      form: {
        firstName: "PRÉNOM",
        lastName: "NOM",
        email: "EMAIL",
        phone: "TÉLÉPHONE",
        date: "DATE DU MARIAGE",
        place: "LIEU PRESSENTI",
        message: "VOTRE MESSAGE",
        messagePh: "Racontez-moi votre projet, votre histoire, votre vision...",
        submit: "ENVOYER MA DEMANDE",
        sent: "Merci ! Votre message est bien parti. Je reviens vers vous très vite.",
        error: "Désolé, une erreur est survenue. Réessayez ou écrivez-moi directement."
      },
      coordsEyebrow: "COORDONNÉES",
      coordsTitle: "Restons en contact",
      coords: [
        ["📍", "Nice, Côte d'Azur", "Disponible partout en France & à l'étranger"],
        ["📞", "06 04 03 70 76", "Lun — Ven, 9h–19h"],
        ["✉︎", "romerophotography.contact@gmail.com", "Réponse sous 48h"]
      ],
      socialEyebrow: "SUR LES RÉSEAUX",
      followInstagram: "@romeromomentsphoto",
      followPinterest: "Romero Photography"
    },

    cta: {
      question: "UNE QUESTION ?",
      line1: "Chaque projet est unique.",
      line2: "Parlons du vôtre."
    },

    footer: {
      tagline: "Photographe de mariage à Nice & dans le monde.",
      explore: "EXPLORER",
      contactCol: "CONTACT",
      legal: "MENTIONS LÉGALES",
      privacy: "POLITIQUE DE CONFIDENTIALITÉ",
      copy: "© 2026 Romero Photography — Tous droits réservés.",
      crafted: "Site conçu avec soin sur la Riviera."
    }
  },

  en: {
    nav: { home: "HOME", about: "ABOUT", services: "SERVICES", portfolio: "PORTFOLIO", blog: "JOURNAL", reviews: "REVIEWS", contact: "CONTACT" },
    book: "BOOK A SESSION",
    tagline: "The art of capturing your emotions",

    home: {
      eyebrow: "WEDDING PHOTOGRAPHY — NICE & BEYOND",
      locale: "Nice · French Riviera · Worldwide",
      title1: "Every moment tells",
      title2: "your story",
      sub: "Romero Photography preserves your most beautiful moments with sensitivity, elegance and a timeless touch.",
      cta: "DISCOVER MY WORLD",
      valuesEyebrow: "MY PROMISE",
      valuesTitle: "Four pillars, one signature",
      values: [
        ["AUTHENTICITY", "Capturing real emotion, without artifice."],
        ["ELEGANCE", "A refined, timeless aesthetic."],
        ["CLOSENESS", "Warm, human guidance every step of the way."],
        ["EXCELLENCE", "Premium delivery worthy of your big day."]
      ],
      featuredEyebrow: "RECENT WEDDINGS",
      featuredTitle: "Stories recently written",
      featuredCta: "VIEW FULL PORTFOLIO",
      bandQuote: "« Mickael caught moments we hadn't even seen. Every image is a living memory. »",
      bandAttr: "— Anastasia & Jordan, wedding in Èze"
    },

    about: {
      eyebrow: "ABOUT",
      title: "A passion, a vision,",
      titleAccent: "a signature",
      lead: "Mickael Romero photographs weddings the way one tells a story — patiently, tenderly, with an eye that knows the right instant when it sees it.",
      bodyEyebrow: "MY STORY",
      bodyTitle: "The art of holding the fleeting",
      body: [
        "Born on the Côte d'Azur, Mickael made Mediterranean light his first companion. After ten years exploring portraiture and reportage, his lens is now devoted to weddings — those days when every second becomes memory.",
        "His approach? Quiet, attentive, deeply human. He doesn't direct, he accompanies. He doesn't pose, he listens. And from that listening, the truest images are born.",
        "Every wedding is unique, every couple has its own language. Mickael learns yours before photographing — so your images look like who you are, not what's expected of you."
      ],
      valuesEyebrow: "MY VALUES",
      valuesTitle: "What guides every frame",
      values: [
        ["EXCELLENCE", "Premium quality from first brief to final delivery."],
        ["EYE FOR DETAIL", "Every glance, every trembling hand, captured."],
        ["EMOTION", "True moments come before perfect images."],
        ["ELEGANCE", "A soft, luminous, timeless aesthetic."]
      ],
      processEyebrow: "MY PROCESS",
      processTitle: "Tailored guidance, end to end",
      process: [
        ["DISCOVERY CALL", "We meet over coffee — your story, your vision, what makes you tick."],
        ["PREPARATION", "Location scouting, detailed planning, tailored adjustments up to the day."],
        ["THE BIG DAY", "Quiet, caring presence from first light to the last slow dance."],
        ["DELIVERY", "Your memories elevated, delivered in a private gallery and printed album."]
      ],
      gearEyebrow: "GEAR",
      gearTitle: "Tools in service of the moment",
      gearLead: "Equipment chosen with care — quiet, luminous, reliable. But the tool doesn't make the image. Vision can't be bought.",
      gear: ["Sony A7 IV — primary body", "Sony A7 III — second body", "Sigma 35mm f/1.4 ART", "85mm f/1.8 portrait", "16-35mm f/2.8 wide", "Profoto B10 — portable lighting"]
    },

    services: {
      eyebrow: "SERVICES",
      title: "Images crafted with",
      titleAccent: "every detail in mind",
      lead: "Three offerings, one promise: every image looks like you, and every memory stays with you.",
      cards: [
        ["FULL WEDDING COVERAGE", "From getting ready to the first dance", "From €2,400", "Full-day coverage from preparations to the first dance. Private online gallery, professional retouching, optional printed album."],
        ["COUPLE / ENGAGEMENT SHOOT", "An intimate moment before the big day", "From €480", "An hour and a half together, by the sea or in a place dear to you. Perfect for getting comfortable in front of the lens."],
        ["PRIVATE EVENTS", "Birthdays, christenings, engagements", "On request", "A sensitive presence for your family celebrations — intimate parties, receptions, milestone birthdays."]
      ],
      zoomEyebrow: "ZOOM ON",
      zoomTitle: "Full coverage, in detail",
      zoomIntro: "One day, one story, one book of images. Here's what's included in every full reportage.",
      includes: [
        ["Getting ready", "Dress, suit, last glances — the wait, the tenderness, the laughter."],
        ["Civil & religious ceremony", "Every gaze, every joined hand, every vow."],
        ["Cocktail & reception", "Your loved ones, their smiles, the atmosphere settling in."],
        ["Dinner & evening", "Speeches, first dances, dancefloor laughter — until the night ends."],
        ["Private online gallery", "Delivered within 4 weeks, accessible for life, easy to share."],
        ["Professional retouching", "Every selected frame, refined in colour and light."]
      ],
      galleryEyebrow: "A FEW IMAGES",
      cta: "LET'S TALK ABOUT YOUR DAY"
    },

    portfolio: {
      eyebrow: "WEDDING PORTFOLIO",
      title: "Love stories",
      titleAccent: "made eternal",
      lead: "Discover the weddings I've had the honour of photographing — each unique, each precious.",
      filters: ["ALL", "FRANCE", "INTERNATIONAL", "INTIMATE"],
      backToPortfolio: "← BACK TO PORTFOLIO",
      seeFull: "VIEW FULL GALLERY",
      caseEyebrow: "WEDDING",
      caseStory: "The story in a few words"
    },

    reviews: {
      eyebrow: "CLIENT REVIEWS",
      title: "They placed their",
      titleAccent: "trust in me",
      lead: "Every wedding is an encounter. Here's what my couples remembered.",
      googleCta: "READ ALL REVIEWS ON GOOGLE",
      stats: [["5.0", "GOOGLE RATING"], ["87", "CLIENT REVIEWS"], ["120+", "WEDDINGS CAPTURED"]],
      live: "LIVE FROM GOOGLE",
      liveTitle: "They lived the experience"
    },

    blog: {
      eyebrow: "JOURNAL",
      title: "Notes from the",
      titleAccent: "Riviera",
      lead: "Tips for couples-to-be, dream venues on the Côte d'Azur, behind-the-scenes — a journal to dream, plan, and be inspired.",
      readMore: "READ ARTICLE",
      categories: ["ALL", "WEDDINGS", "VENUES", "TIPS"],
      featured: "FEATURED"
    },

    contact: {
      eyebrow: "GET IN TOUCH",
      title: "Your story deserves",
      titleAccent: "to be told",
      lead: "Tell me about your project — date, place, atmosphere — and I'll be back in touch within 48 hours.",
      form: {
        firstName: "FIRST NAME",
        lastName: "LAST NAME",
        email: "EMAIL",
        phone: "PHONE",
        date: "WEDDING DATE",
        place: "LOCATION",
        message: "YOUR MESSAGE",
        messagePh: "Tell me about your project, your story, your vision...",
        submit: "SEND MY ENQUIRY",
        sent: "Thank you! Your message has been sent. I'll be in touch very soon.",
        error: "Sorry, something went wrong. Try again or email me directly."
      },
      coordsEyebrow: "REACH OUT",
      coordsTitle: "Let's stay in touch",
      coords: [
        ["📍", "Nice, Côte d'Azur", "Available across France & abroad"],
        ["📞", "+33 6 04 03 70 76", "Mon – Fri, 9am–7pm"],
        ["✉︎", "romerophotography.contact@gmail.com", "Reply within 48h"]
      ],
      socialEyebrow: "ON SOCIAL",
      followInstagram: "@romeromomentsphoto",
      followPinterest: "Romero Photography"
    },

    cta: {
      question: "A QUESTION?",
      line1: "Every project is unique.",
      line2: "Let's talk about yours."
    },

    footer: {
      tagline: "Wedding photographer in Nice & worldwide.",
      explore: "EXPLORE",
      contactCol: "CONTACT",
      legal: "LEGAL NOTICE",
      privacy: "PRIVACY POLICY",
      copy: "© 2026 Romero Photography — All rights reserved.",
      crafted: "Crafted with care on the Riviera."
    }
  }
};

export function getStrings(lang: Lang): Strings {
  return STRINGS[lang] || STRINGS.fr;
}

export function isLang(v: unknown): v is Lang {
  return v === "fr" || v === "en";
}
