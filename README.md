# Romero Photography — Site

Site complet du photographe Mickael Romero (Nice / Côte d'Azur), construit avec Next.js 14 + SQLite.
Implémenté à partir du design Claude `site-romero-photography`.

## Stack

- **Next.js 14** (App Router, Server Components, Server Actions)
- **SQLite** via `better-sqlite3` (base locale dans `data/romero.db`)
- **Auth** par cookie HttpOnly signé (HMAC-SHA256) + bcrypt
- **i18n** FR / EN (cookie `lang`)
- **Uploads** stockés en local sous `public/uploads/`

## Démarrer

```bash
npm install
npm run dev    # http://localhost:3000
```

Pour la prod :
```bash
npm run build && npm start
```

## Espace administrateur

- URL : http://localhost:3000/admin
- Email par défaut : `admin@romero.local`
- Mot de passe par défaut : `admin`

**Change-les dès le premier login** dans `Compte`.

### Sections de l'admin

- **Dashboard** — vue d'ensemble + derniers messages
- **Galeries** — créer/modifier/supprimer les galeries de mariages, uploader plusieurs photos d'un coup, définir une couverture, choisir la disposition (large/haute/grande/standard) dans la galerie masonry
- **Journal** — articles du blog (FR/EN, image de couverture)
- **Avis** — témoignages clients (FR/EN)
- **Messages** — demandes reçues via le formulaire de contact (marquage lu/non lu, suppression)
- **Paramètres** — coordonnées (ville, téléphone, email, réseaux)
- **Design** — palette, polices, mise en page, ornements, traitement photo, préréglages
- **Compte** — changement d'email et de mot de passe

## Structure

```
src/
  app/
    (site)/             # Layout public (header/footer + content)
      page.tsx          # Accueil
      a-propos/         # À propos
      prestations/      # Services
      portfolio/        # Liste + [slug] détail
      avis/             # Reviews
      blog/             # Journal
      contact/          # Formulaire
    admin/
      login/            # Page de connexion (pas de chrome)
      (panel)/          # Layout admin (sidebar) — protégé
        page.tsx        # Dashboard
        galleries/      # CRUD galeries + upload photos
        posts/          # CRUD articles
        reviews/        # CRUD avis
        messages/       # Inbox
        settings/       # Coordonnées
        design/         # Tweaks design
        account/        # Email / mot de passe
    api/
      contact/          # POST → enregistre un message
      auth/login/       # POST → cookie de session
      auth/logout/      # POST → supprime le cookie
  components/           # Composants partagés (Monogram, Header, Footer, etc.)
  lib/
    i18n.ts             # Dictionnaires FR/EN
    db.ts               # Schema + seed
    auth.ts             # Sessions + bcrypt
    settings.ts         # Tokens design + tables d'options
    content.ts          # Helpers de lecture (galleries, posts, reviews)
    lang.ts             # Cookie lang
  middleware.ts         # Protège /admin/*
  styles/globals.css    # Styles globaux (portés depuis le prototype)
data/
  romero.db             # Base SQLite (créée au premier démarrage)
public/
  uploads/              # Photos uploadées (hero.jpg + galleries/*.jpg)
```

## Sécurité — à faire avant la prod

1. Définir `AUTH_SECRET` dans `.env.local` (string aléatoire long)
2. Changer l'email et le mot de passe admin
3. Servir derrière HTTPS (le cookie passe automatiquement en `secure` quand `NODE_ENV=production`)
4. (Optionnel) Ajouter un rate-limit sur `/api/contact` et `/api/auth/login`

## Personnalisation rapide

- Photos seed → placer dans `public/uploads/galleries/` puis associer via l'admin
- Textes statiques (FR/EN) → `src/lib/i18n.ts`
- Tokens par défaut → table `settings` (modifiable via `/admin/design`)
