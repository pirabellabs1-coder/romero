import { unstable_noStore as noStore } from "next/cache";
import { getDb } from "@/lib/db";

export type Settings = {
  contact_city: string;
  contact_phone: string;
  contact_email: string;
  instagram_handle: string;
  instagram_url: string;
  google_reviews_url: string;
  pinterest_handle?: string;
  accent: string;
  background: string;
  foreground: string;
  sage_tone: string;
  display_font: string;
  body_font: string;
  image_treatment: string;
  italic_titles: string;
  watercolor: string;
  ornaments: string;
  section_density: string;
  image_radius: string;
  caps_tracking: string;
  font_scale: string;
  monogram_style: string;
  header_style: string;
  button_style: string;
};

// In-memory cache to avoid repeating the same SQL query on every render of the same request lifecycle.
// TTL is short (15s) because the admin can update tokens at any moment, and revalidatePath() invalidates Next's caches anyway.
let _cache: { value: Settings; expiresAt: number } | null = null;
const CACHE_TTL_MS = 15_000;

export function getSettings(): Settings {
  noStore();
  const now = Date.now();
  if (_cache && _cache.expiresAt > now) return _cache.value;
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  const value = out as unknown as Settings;
  _cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

export function invalidateSettingsCache() {
  _cache = null;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
  invalidateSettingsCache();
}

export function setSettings(updates: Record<string, string>) {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  const tx = db.transaction((entries: [string, string][]) => {
    for (const [k, v] of entries) stmt.run(k, v);
  });
  tx(Object.entries(updates));
  invalidateSettingsCache();
}

/* ---------- design token mapping (mirrors prototype app.jsx) ---------- */
export const ACCENTS: Record<string, { name: string; light: string; deep: string }> = {
  "#B8975A": { name: "Vieil or", light: "#D4B57A", deep: "#8E7340" },
  "#C2A878": { name: "Champagne", light: "#DDC799", deep: "#967F4E" },
  "#B98B86": { name: "Rose poudré", light: "#D4ACA7", deep: "#8C625E" },
  "#9C7A4F": { name: "Bronze", light: "#BF9B6E", deep: "#74583A" },
  "#7E8B79": { name: "Olivier", light: "#A2AE9D", deep: "#5C685A" },
  "#6E5945": { name: "Café", light: "#917865", deep: "#4B3D2E" },
  "#A89376": { name: "Sable", light: "#C4B299", deep: "#7E6C53" },
  "#5E6B84": { name: "Bleu nuit", light: "#8896A8", deep: "#404B5E" },
};

export const DISPLAY_FONTS: Record<string, { stack: string; google: string }> = {
  "Cormorant Garamond": { stack: '"Cormorant Garamond", "EB Garamond", Georgia, serif', google: "Cormorant+Garamond:wght@300;400;500;600" },
  "Playfair Display": { stack: '"Playfair Display", Georgia, serif', google: "Playfair+Display:wght@400;500;600;700" },
  "DM Serif Display": { stack: '"DM Serif Display", Georgia, serif', google: "DM+Serif+Display" },
  "EB Garamond": { stack: '"EB Garamond", Georgia, serif', google: "EB+Garamond:wght@400;500;600" },
  "Italiana": { stack: '"Italiana", Georgia, serif', google: "Italiana" },
  "Tenor Sans": { stack: '"Tenor Sans", Georgia, serif', google: "Tenor+Sans" },
  "Cardo": { stack: '"Cardo", Georgia, serif', google: "Cardo:wght@400;700" },
  "Libre Caslon Text": { stack: '"Libre Caslon Text", Georgia, serif', google: "Libre+Caslon+Text:wght@400;700" },
};

export const BODY_FONTS: Record<string, { stack: string; google: string }> = {
  Inter: { stack: "Inter, system-ui, sans-serif", google: "Inter:wght@300;400;500;600" },
  Lato: { stack: "Lato, system-ui, sans-serif", google: "Lato:wght@300;400;500;700" },
  Montserrat: { stack: "Montserrat, system-ui, sans-serif", google: "Montserrat:wght@300;400;500;600" },
  "Work Sans": { stack: '"Work Sans", system-ui, sans-serif', google: "Work+Sans:wght@300;400;500;600" },
  Jost: { stack: "Jost, system-ui, sans-serif", google: "Jost:wght@300;400;500;600" },
  "Nunito Sans": { stack: '"Nunito Sans", system-ui, sans-serif', google: "Nunito+Sans:wght@300;400;500;600" },
};

export const BACKGROUNDS: Record<string, { name: string; base: string; deep: string; shadow: string }> = {
  cream: { name: "Crème", base: "#F8F4EC", deep: "#F0E8D8", shadow: "#E8DFCE" },
  ivory: { name: "Ivoire", base: "#FBF8F1", deep: "#F4EEDF", shadow: "#EAE2CE" },
  pearl: { name: "Perle", base: "#FAFAF7", deep: "#F1F0E8", shadow: "#E5E3D7" },
  blush: { name: "Blush", base: "#FAF3EE", deep: "#F2E5DB", shadow: "#E7D5C5" },
  stone: { name: "Pierre", base: "#F2EFE8", deep: "#E8E2D4", shadow: "#D9D0BE" },
  snow: { name: "Neige", base: "#FBFAF7", deep: "#F2F1ED", shadow: "#E4E2DA" },
  almond: { name: "Amande", base: "#F5EFE2", deep: "#E9DFC8", shadow: "#D6C8AB" },
  linen: { name: "Lin", base: "#F4EEE2", deep: "#E8DFCC", shadow: "#D5C8AE" },
};

export const FOREGROUNDS: Record<string, { name: string; base: string; deep: string; ink: string }> = {
  forest: { name: "Vert forêt", base: "#2E3D2E", deep: "#1F2A1F", ink: "#2A2520" },
  charcoal: { name: "Charbon", base: "#2A2A2A", deep: "#1A1A1A", ink: "#1F1F1F" },
  espresso: { name: "Espresso", base: "#3B2D22", deep: "#241A12", ink: "#2A1F16" },
  midnight: { name: "Bleu nuit", base: "#1F2B3A", deep: "#121A24", ink: "#1A2330" },
  wine: { name: "Bordeaux", base: "#3D2129", deep: "#27141B", ink: "#301A20" },
  ink: { name: "Encre", base: "#1F1F23", deep: "#0F0F12", ink: "#16161A" },
};

export const SAGE_TONES: Record<string, { name: string; base: string; soft: string; deep: string }> = {
  sage: { name: "Sauge", base: "#C8D5C4", soft: "#DDE5D9", deep: "#9DB29A" },
  mint: { name: "Menthe", base: "#CFDFD0", soft: "#E2EBDF", deep: "#A2BAA4" },
  eucalyptus: { name: "Eucalyptus", base: "#B8C9B8", soft: "#D4DFD2", deep: "#8FA68F" },
  celadon: { name: "Céladon", base: "#D2DFD2", soft: "#E5ECE2", deep: "#A8BBA5" },
  olive: { name: "Olive", base: "#C8CDA8", soft: "#DDE0C5", deep: "#9DA77B" },
  smoke: { name: "Fumée", base: "#CDD2CC", soft: "#E0E3DD", deep: "#A1A8A0" },
  dusty: { name: "Bleu pâle", base: "#C5D2D6", soft: "#DCE3E5", deep: "#9AAAB1" },
};

export function buildTokenStyle(s: Settings): { css: string; googleFontHref: string } {
  const a = ACCENTS[s.accent] || ACCENTS["#B8975A"];
  const bg = BACKGROUNDS[s.background] || BACKGROUNDS.cream;
  const fg = FOREGROUNDS[s.foreground] || FOREGROUNDS.forest;
  const sg = SAGE_TONES[s.sage_tone] || SAGE_TONES.sage;
  const df = DISPLAY_FONTS[s.display_font] || DISPLAY_FONTS["Cormorant Garamond"];
  const bf = BODY_FONTS[s.body_font] || BODY_FONTS.Inter;

  let filter = "none";
  if (s.image_treatment === "sepia") filter = "sepia(0.35) saturate(0.85) brightness(1.02)";
  else if (s.image_treatment === "bw") filter = "grayscale(1) contrast(1.05)";
  else if (s.image_treatment === "warm") filter = "saturate(1.1) hue-rotate(-5deg) brightness(1.03)";
  else if (s.image_treatment === "soft") filter = "saturate(0.85) brightness(1.05) contrast(0.95)";

  let pad = "110px";
  if (s.section_density === "compact") pad = "70px";
  else if (s.section_density === "spacious") pad = "160px";

  const scale = Math.max(50, Math.min(200, Number(s.font_scale) || 100)) / 100;
  const tracking = Math.max(0, Math.min(100, Number(s.caps_tracking) || 32)) / 100;
  const radius = Math.max(0, Math.min(60, Number(s.image_radius) || 4));

  const ornamentOpacity = s.ornaments === "none" ? "0" : s.ornaments === "subtle" ? "0.5" : s.ornaments === "rich" ? "1" : "0.85";
  const waterOpacity = s.watercolor === "0" ? "0" : "1";
  const italicStyle = s.italic_titles === "0" ? "normal" : "italic";

  const css = `:root {
    --cream: ${bg.base}; --cream-deep: ${bg.deep}; --cream-shadow: ${bg.shadow};
    --sage: ${sg.base}; --sage-soft: ${sg.soft}; --sage-deep: ${sg.deep};
    --gold: ${s.accent}; --gold-light: ${a.light}; --gold-deep: ${a.deep};
    --forest: ${fg.base}; --forest-deep: ${fg.deep}; --ink: ${fg.ink};
    --rule: ${s.accent}40;
    --serif: ${df.stack}; --serif-display: ${df.stack}; --sans: ${bf.stack};
    --fs-scale: ${scale};
    --img-radius: ${radius}px;
    --img-filter: ${filter};
    --section-pad: ${pad};
    --watercolor-opacity: ${waterOpacity};
    --ornament-opacity: ${ornamentOpacity};
    --display-italic-style: ${italicStyle};
    --caps-tracking: ${tracking}em;
  }`;

  const googleFontHref = `https://fonts.googleapis.com/css2?family=${df.google}&family=${bf.google}&display=swap`;

  return { css, googleFontHref };
}
