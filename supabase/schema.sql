-- ═══════════════════════════════════════════════════════════════════════════
-- Romero Photography — Postgres schema (Supabase)
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in: Dashboard → SQL Editor → New query → paste → Run
--
-- Idempotent: safe to re-run. Creates tables and seeds default settings if
-- the table is empty. Existing data is preserved on re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Users (admin login) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Settings (key/value site config) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- ── Galleries (weddings portfolio) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.galleries (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  names           TEXT NOT NULL,
  place           TEXT NOT NULL,
  date_label      TEXT NOT NULL DEFAULT '',
  region          TEXT NOT NULL DEFAULT 'FRANCE',
  kind            TEXT NOT NULL DEFAULT 'MARIAGE',
  intro_fr        TEXT NOT NULL DEFAULT '',
  intro_en        TEXT NOT NULL DEFAULT '',
  cover_photo_id  BIGINT,
  featured        SMALLINT NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  published       SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Photos (gallery items) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.photos (
  id          BIGSERIAL PRIMARY KEY,
  gallery_id  BIGINT REFERENCES public.galleries(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  alt         TEXT DEFAULT '',
  span        TEXT DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS photos_gallery_id_idx ON public.photos(gallery_id, sort_order);

-- ── Posts (blog) ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  title_fr        TEXT NOT NULL,
  title_en        TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL,
  excerpt_fr      TEXT NOT NULL DEFAULT '',
  excerpt_en      TEXT NOT NULL DEFAULT '',
  body_fr         TEXT NOT NULL DEFAULT '',
  body_en         TEXT NOT NULL DEFAULT '',
  cover_filename  TEXT,
  published_at    TEXT NOT NULL,
  read_minutes    INTEGER NOT NULL DEFAULT 5,
  published       SMALLINT NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Reviews ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  date_label  TEXT NOT NULL,
  rating      INTEGER NOT NULL DEFAULT 5,
  text_fr     TEXT NOT NULL,
  text_en     TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  published   SMALLINT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Messages (contact form inbox) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id            BIGSERIAL PRIMARY KEY,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT DEFAULT '',
  wedding_date  TEXT DEFAULT '',
  place         TEXT DEFAULT '',
  message       TEXT NOT NULL,
  lang          TEXT NOT NULL DEFAULT 'fr',
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS messages_read_at_idx ON public.messages(read_at) WHERE read_at IS NULL;

-- ── Row-Level Security ───────────────────────────────────────────────────
-- We disable RLS on these tables because all access goes through the
-- service_role key from server-side code (Next.js server actions / API
-- routes). The anon/publishable key is never used to hit these tables
-- directly from the browser. Auth is handled at the application layer
-- via the existing session cookie (lib/auth.ts).
ALTER TABLE public.users      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.galleries  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages   DISABLE ROW LEVEL SECURITY;

-- ── Default settings (idempotent insert) ────────────────────────────────
INSERT INTO public.settings (key, value) VALUES
  ('contact_city', 'Nice, Côte d''Azur'),
  ('contact_phone', '06 04 03 70 76'),
  ('contact_email', 'romerophotography.contact@gmail.com'),
  ('instagram_handle', '@romeromomentsphoto'),
  ('instagram_url', 'https://www.instagram.com/romeromomentsphoto'),
  ('google_reviews_url', 'https://share.google/ckAXNbRvvnfKv1o1T'),
  ('accent', '#B8975A'),
  ('background', 'cream'),
  ('foreground', 'forest'),
  ('sage_tone', 'sage'),
  ('display_font', 'Cormorant Garamond'),
  ('body_font', 'Inter'),
  ('image_treatment', 'natural'),
  ('italic_titles', '1'),
  ('watercolor', '1'),
  ('ornaments', 'regular'),
  ('section_density', 'regular'),
  ('image_radius', '4'),
  ('caps_tracking', '32'),
  ('font_scale', '100'),
  ('monogram_style', 'framed'),
  ('header_style', 'transparent'),
  ('button_style', 'sage')
ON CONFLICT (key) DO NOTHING;

-- ── Agents IA (installation & configuration) ─────────────────────────────
-- Chaque ligne = un agent installable dans le dashboard. La config est
-- stockée en JSONB pour rester souple (clés API, prompts, params par
-- plateforme…). Idempotent : les 4 agents de base sont insérés si absents.
CREATE TABLE IF NOT EXISTS public.agent_installations (
  slug          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'not_installed'
                CHECK (status IN ('not_installed','installing','installed','error','paused')),
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  system_prompt TEXT NOT NULL DEFAULT '',
  installed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Ajout idempotent de system_prompt si la table préexistait sans.
ALTER TABLE public.agent_installations
  ADD COLUMN IF NOT EXISTS system_prompt TEXT NOT NULL DEFAULT '';

INSERT INTO public.agent_installations (slug, name) VALUES
  ('site',      'Agent site — chatbot & prise de RDV'),
  ('whatsapp',  'Assistant WhatsApp + Agenda'),
  ('marketing', 'Agent Marketing — IG / LinkedIn / Blog'),
  ('admin',     'Agent Administratif & Juridique')
ON CONFLICT (slug) DO NOTHING;

-- Base de connaissances par agent : chaque entrée = un fait, un extrait
-- de FAQ, une politique, un texte de référence. Utilisé comme contexte
-- injecté dans le prompt à chaque exécution (RAG basique côté produit ;
-- on peut passer à un embedding + pgvector plus tard sans casser l'UI).
CREATE TABLE IF NOT EXISTS public.agent_knowledge (
  id           BIGSERIAL PRIMARY KEY,
  agent_slug   TEXT NOT NULL REFERENCES public.agent_installations(slug) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'general',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_slug ON public.agent_knowledge(agent_slug);

-- Journal d'événements agent (pour statistiques + audit). Un event =
-- une action visible : conversation, RDV pris, post généré, contrat
-- signé, erreur… Le payload JSONB accueille les détails.
CREATE TABLE IF NOT EXISTS public.agent_events (
  id           BIGSERIAL PRIMARY KEY,
  agent_slug   TEXT NOT NULL REFERENCES public.agent_installations(slug) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  success      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_events_slug_time ON public.agent_events(agent_slug, created_at DESC);

-- Historique du playground (test des prompts). On garde tout pour que
-- le photographe puisse comparer avant/après un changement de prompt.
CREATE TABLE IF NOT EXISTS public.agent_test_messages (
  id             BIGSERIAL PRIMARY KEY,
  agent_slug     TEXT NOT NULL REFERENCES public.agent_installations(slug) ON DELETE CASCADE,
  input_text     TEXT NOT NULL,
  output_text    TEXT NOT NULL,
  prompt_snapshot TEXT NOT NULL DEFAULT '',
  duration_ms    INTEGER NOT NULL DEFAULT 0,
  success        BOOLEAN NOT NULL DEFAULT TRUE,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_test_msgs_slug_time ON public.agent_test_messages(agent_slug, created_at DESC);

-- ── Chatbot public : conversations & leads ───────────────────────────────
-- Une conversation = une session visiteur sur le site public. Le lead_data
-- JSONB s'enrichit au fil des tours via l'outil `record_lead_info` que
-- Claude appelle quand il détecte une nouvelle info. Les messages
-- individuels vont dans chat_messages (rôle + contenu + tool_calls).
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id             BIGSERIAL PRIMARY KEY,
  session_id     TEXT UNIQUE NOT NULL,
  agent_slug     TEXT NOT NULL DEFAULT 'site' REFERENCES public.agent_installations(slug) ON DELETE CASCADE,
  lead_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  notified       BOOLEAN NOT NULL DEFAULT FALSE,
  notified_at    TIMESTAMPTZ,
  user_agent     TEXT,
  referrer       TEXT,
  message_count  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_conv_created ON public.chat_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conv_notified ON public.chat_conversations(notified);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content         TEXT NOT NULL,
  tool_calls      JSONB,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON public.chat_messages(conversation_id, created_at);

-- ── Assistant WhatsApp/Telegram (agent 2) ────────────────────────────────
-- Une session = une conversation continue avec un utilisateur (Mickael
-- typiquement, mais on stocke `platform_user_id` proprement au cas où on
-- ouvre à d'autres). L'historique conversationnel vit dans
-- assistant_messages, comme chat_messages pour l'agent site.
CREATE TABLE IF NOT EXISTS public.assistant_sessions (
  id                BIGSERIAL PRIMARY KEY,
  platform          TEXT NOT NULL CHECK (platform IN ('telegram','whatsapp')),
  platform_user_id  TEXT NOT NULL,
  display_name      TEXT,
  message_count     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform, platform_user_id)
);
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_updated ON public.assistant_sessions(updated_at DESC);

CREATE TABLE IF NOT EXISTS public.assistant_messages (
  id              BIGSERIAL PRIMARY KEY,
  session_id      BIGINT NOT NULL REFERENCES public.assistant_sessions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content         TEXT NOT NULL,
  tool_calls      JSONB,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_session ON public.assistant_messages(session_id, created_at);

-- ── Sanity check ─────────────────────────────────────────────────────────
SELECT 'tables created:' AS status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') AS public_tables_count;
