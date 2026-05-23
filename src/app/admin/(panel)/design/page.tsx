import { getSettings, ACCENTS, BACKGROUNDS, FOREGROUNDS, SAGE_TONES, DISPLAY_FONTS, BODY_FONTS } from "@/lib/settings";
import { updateDesign, applyPreset } from "./actions";
import LiveSlider from "@/components/admin/LiveSlider";

export const dynamic = "force-dynamic";

export default function DesignAdmin({ searchParams }: { searchParams: { ok?: string } }) {
  const s = getSettings();

  // Key used to force-remount the form whenever settings change (e.g. after a preset).
  // Without this, React keeps uncontrolled <select> values across re-renders and the
  // next save would re-submit the pre-preset values, undoing the preset.
  const formKey = [
    s.accent, s.background, s.foreground, s.sage_tone,
    s.display_font, s.body_font, s.font_scale, s.caps_tracking, s.italic_titles,
    s.section_density, s.header_style, s.button_style, s.monogram_style,
    s.image_treatment, s.image_radius, s.ornaments, s.watercolor,
  ].join("|");

  return (
    <>
      <h1 className="admin-h1">Design</h1>
      <p className="admin-sub">
        Palette, typographie, mise en page. Les changements s&apos;appliquent immédiatement à tout le site.
      </p>

      {searchParams.ok === "1" && <div className="admin-flash ok">Design mis à jour.</div>}
      {searchParams.ok === "preset" && <div className="admin-flash ok">Préréglage appliqué.</div>}

      <div className="admin-card">
        <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 18px" }}>Préréglages</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {[
            ["provence", "🌿 Provence"],
            ["minimal", "🤍 Pure & minimal"],
            ["rose", "🌹 Rose éditorial"],
            ["night", "🌙 Nuit luxe"],
            ["vintage", "📜 Magazine vintage"],
          ].map(([key, label]) => (
            <form action={applyPreset.bind(null, key)} key={key}>
              <button className="admin-btn ghost" type="submit">{label}</button>
            </form>
          ))}
        </div>
      </div>

      <form action={updateDesign} key={formKey}>
        <div className="admin-card">
          <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 18px" }}>Palette</h2>
          <div className="admin-grid cols-2">
            <Field label="Accent (or)">
              <select className="admin-select" name="accent" defaultValue={s.accent}>
                {Object.entries(ACCENTS).map(([hex, info]) => (
                  <option key={hex} value={hex}>{info.name} ({hex})</option>
                ))}
              </select>
            </Field>
            <Field label="Fond">
              <select className="admin-select" name="background" defaultValue={s.background}>
                {Object.entries(BACKGROUNDS).map(([k, info]) => (
                  <option key={k} value={k}>{info.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Texte sombre">
              <select className="admin-select" name="foreground" defaultValue={s.foreground}>
                {Object.entries(FOREGROUNDS).map(([k, info]) => (
                  <option key={k} value={k}>{info.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Vert sauge">
              <select className="admin-select" name="sage_tone" defaultValue={s.sage_tone}>
                {Object.entries(SAGE_TONES).map(([k, info]) => (
                  <option key={k} value={k}>{info.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="admin-card">
          <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 18px" }}>Typographie</h2>
          <div className="admin-grid cols-2">
            <Field label="Titres (serif)">
              <select className="admin-select" name="display_font" defaultValue={s.display_font}>
                {Object.keys(DISPLAY_FONTS).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </Field>
            <Field label="Texte (sans)">
              <select className="admin-select" name="body_font" defaultValue={s.body_font}>
                {Object.keys(BODY_FONTS).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </Field>
            <LiveSlider label="Taille de la police" name="font_scale" defaultValue={s.font_scale} min={70} max={130} unit="%" />
            <LiveSlider label="Espacement capitales" name="caps_tracking" defaultValue={s.caps_tracking} min={10} max={50} unit="/100em" />
            <Field label="Titres italiques">
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
                <input type="checkbox" name="italic_titles" defaultChecked={s.italic_titles !== "0"} value="1" /> Activer
              </label>
            </Field>
          </div>
        </div>

        <div className="admin-card">
          <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 18px" }}>Mise en page</h2>
          <div className="admin-grid cols-2">
            <Field label="Densité">
              <select className="admin-select" name="section_density" defaultValue={s.section_density}>
                <option value="compact">Compact</option>
                <option value="regular">Régulière</option>
                <option value="spacious">Spacieuse</option>
              </select>
            </Field>
            <Field label="Header (au scroll)">
              <select className="admin-select" name="header_style" defaultValue={s.header_style}>
                <option value="transparent">Transparent</option>
                <option value="cream">Crème</option>
                <option value="sage">Sauge</option>
              </select>
            </Field>
            <Field label="Boutons">
              <select className="admin-select" name="button_style" defaultValue={s.button_style}>
                <option value="sage">Sauge</option>
                <option value="gold">Or</option>
                <option value="forest">Forêt</option>
              </select>
            </Field>
            <Field label="Monogramme">
              <select className="admin-select" name="monogram_style" defaultValue={s.monogram_style}>
                <option value="framed">Encadré</option>
                <option value="minimal">Minimal</option>
                <option value="circle">Cercle</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="admin-card">
          <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 18px" }}>Images &amp; ornements</h2>
          <div className="admin-grid cols-2">
            <Field label="Traitement photo">
              <select className="admin-select" name="image_treatment" defaultValue={s.image_treatment}>
                <option value="natural">Naturel</option>
                <option value="warm">Chaud</option>
                <option value="soft">Doux</option>
                <option value="sepia">Sépia</option>
                <option value="bw">Noir &amp; blanc</option>
              </select>
            </Field>
            <LiveSlider label="Coins arrondis" name="image_radius" defaultValue={s.image_radius} min={0} max={24} unit="px" />
            <Field label="Ornements">
              <select className="admin-select" name="ornaments" defaultValue={s.ornaments}>
                <option value="none">Aucun</option>
                <option value="subtle">Discrets</option>
                <option value="regular">Réguliers</option>
                <option value="rich">Riches</option>
              </select>
            </Field>
            <Field label="Aquarelle">
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
                <input type="checkbox" name="watercolor" defaultChecked={s.watercolor !== "0"} value="1" /> Activer
              </label>
            </Field>
          </div>
        </div>

        <button className="admin-btn" type="submit">ENREGISTRER LE DESIGN</button>
      </form>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="admin-label">{label}</label>
      {children}
    </div>
  );
}
