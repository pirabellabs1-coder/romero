"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelScheduledInstagramAction,
  deleteBriefAction,
  markLinkedInCopiedAction,
  publishBlogAction,
  publishInstagramAction,
  refreshInstagramInsightsAction,
  regenerateDraftsAction,
  scheduleInstagramAction,
  updateBriefDraftAction,
  type Brief,
} from "../marketing-actions";

type Props = {
  brief: Brief;
  defaultOpen?: boolean;
  hasInstagramCreds: boolean;
};

type Platform = "instagram" | "linkedin" | "blog";

export default function BriefCard({ brief, defaultOpen, hasInstagramCreds }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [tab, setTab] = useState<Platform>("instagram");
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  // Édition inline (chaque plateforme a son état local)
  const [igCaption, setIgCaption] = useState(brief.instagram_caption ?? "");
  const [igHashtags, setIgHashtags] = useState(brief.instagram_hashtags ?? "");
  // Programmation IG : datetime-local formaté (YYYY-MM-DDTHH:mm)
  const defaultScheduleTime = (() => {
    const d = new Date(Date.now() + 60 * 60 * 1000); // +1 h
    d.setSeconds(0, 0);
    // Ajuste au fuseau local pour l'input datetime-local
    const off = d.getTimezoneOffset();
    d.setMinutes(d.getMinutes() - off);
    return d.toISOString().slice(0, 16);
  })();
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleTime);
  const [showSchedule, setShowSchedule] = useState(false);
  const [linkedin, setLinkedin] = useState(brief.linkedin_post ?? "");
  const [blogTitle, setBlogTitle] = useState(brief.blog_title ?? "");
  const [blogSlug, setBlogSlug] = useState(brief.blog_slug ?? "");
  const [blogMeta, setBlogMeta] = useState(brief.blog_meta_description ?? "");
  const [blogContent, setBlogContent] = useState(brief.blog_content_md ?? "");

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string
  ) {
    setFlash(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setFlash({ ok: true, msg: okMsg });
        router.refresh();
      } else if ("error" in res) {
        setFlash({ ok: false, msg: res.error ?? "Erreur inconnue" });
      }
    });
  }

  function savePlatform(p: Platform) {
    const patch: Record<string, string> = {};
    if (p === "instagram") {
      patch.instagram_caption = igCaption;
      patch.instagram_hashtags = igHashtags;
    } else if (p === "linkedin") {
      patch.linkedin_post = linkedin;
    } else {
      patch.blog_title = blogTitle;
      patch.blog_slug = blogSlug;
      patch.blog_meta_description = blogMeta;
      patch.blog_content_md = blogContent;
    }
    run(
      () =>
        updateBriefDraftAction({
          briefId: brief.id,
          platform: p,
          patch,
        }),
      "Draft mis à jour."
    );
  }

  const captionCount = igCaption.length;
  const hashtagCount = igHashtags.split(/\s+/).filter((h) => h.startsWith("#")).length;

  return (
    <div className="agent-panel">
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gold-light,#D4B57A)", marginBottom: 4 }}>
            Brief #{brief.id} · {brief.brief_source} · {new Date(brief.created_at).toLocaleString("fr-FR")}
          </div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "rgba(244,239,227,0.85)" }}>
            {brief.brief_text.length > 200 && !open
              ? brief.brief_text.slice(0, 200) + "…"
              : brief.brief_text}
          </p>

          {/* Photos */}
          {brief.photo_urls && brief.photo_urls.length > 0 ? (
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              {brief.photo_urls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`Brief ${brief.id} photo ${i + 1}`}
                  style={{
                    width: 60,
                    height: 60,
                    objectFit: "cover",
                    borderRadius: 3,
                    border: "1px solid rgba(184,151,90,0.28)",
                  }}
                />
              ))}
            </div>
          ) : null}

          {/* Badges statut */}
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            <span
              className={`agent-badge agent-badge--${brief.instagram_status === "published" ? "installed" : brief.instagram_status === "failed" ? "error" : "not-installed"}`}
              style={{ padding: "3px 8px", fontSize: 9 }}
            >
              IG · {brief.instagram_status}
            </span>
            <span
              className={`agent-badge agent-badge--${brief.linkedin_status === "copied" ? "installed" : "not-installed"}`}
              style={{ padding: "3px 8px", fontSize: 9 }}
            >
              LinkedIn · {brief.linkedin_status}
            </span>
            <span
              className={`agent-badge agent-badge--${brief.blog_post_id ? "installed" : "not-installed"}`}
              style={{ padding: "3px 8px", fontSize: 9 }}
            >
              Blog · {brief.blog_post_id ? "brouillon créé" : "non-publié"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <button
            type="button"
            className="agent-btn agent-btn--ghost"
            onClick={() => setOpen(!open)}
            style={{ fontSize: 10, padding: "6px 10px" }}
          >
            {open ? "Fermer" : "Ouvrir"}
          </button>
        </div>
      </div>

      {/* Corps déplié */}
      {open ? (
        <>
          {flash ? (
            <div
              className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`}
              style={{ marginTop: 18 }}
            >
              {flash.ok ? "✓" : "✗"} {flash.msg}
            </div>
          ) : null}

          {/* Sous-onglets IG / LI / Blog */}
          <nav
            className="agent-tabs"
            role="tablist"
            style={{ marginTop: 20, marginBottom: 0 }}
          >
            {(["instagram", "linkedin", "blog"] as Platform[]).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={tab === p}
                onClick={() => setTab(p)}
                className={`agent-tab ${tab === p ? "agent-tab--active" : ""}`}
                style={{
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {p === "instagram" ? "Instagram" : p === "linkedin" ? "LinkedIn" : "Blog"}
              </button>
            ))}
          </nav>

          {/* ── Instagram ── */}
          {tab === "instagram" ? (
            <div style={{ paddingTop: 22 }}>
              <div className="agent-form-field">
                <label>
                  Caption ({captionCount}/2 200)
                </label>
                <textarea
                  value={igCaption}
                  onChange={(e) => setIgCaption(e.target.value)}
                  style={{ minHeight: 200 }}
                />
              </div>
              <div className="agent-form-field">
                <label>
                  Hashtags ({hashtagCount})
                </label>
                <textarea
                  value={igHashtags}
                  onChange={(e) => setIgHashtags(e.target.value)}
                  style={{ minHeight: 80 }}
                />
                <span className="agent-form-field__help">
                  Meta n'accepte pas plus de 30 hashtags par post.
                </span>
              </div>

              {brief.instagram_error ? (
                <div className="agent-flash agent-flash--err" style={{ marginBottom: 12 }}>
                  Erreur précédente : {brief.instagram_error}
                </div>
              ) : null}

              <div className="agent-actions">
                <button
                  type="button"
                  className="agent-btn agent-btn--ghost"
                  onClick={() => savePlatform("instagram")}
                  disabled={pending}
                >
                  Enregistrer les modifications
                </button>
                {hasInstagramCreds && brief.photo_urls?.length > 0 ? (
                  <>
                    <button
                      type="button"
                      className="agent-btn agent-btn--primary"
                      onClick={() =>
                        run(
                          () => publishInstagramAction(brief.id),
                          "Post publié sur Instagram."
                        )
                      }
                      disabled={pending || brief.instagram_status === "published"}
                    >
                      {brief.instagram_status === "published"
                        ? "Déjà publié"
                        : pending
                        ? "Publication…"
                        : "Publier maintenant"}
                    </button>
                    {brief.instagram_status !== "published" ? (
                      <button
                        type="button"
                        className="agent-btn agent-btn--ghost"
                        onClick={() => setShowSchedule(!showSchedule)}
                        disabled={pending}
                      >
                        {showSchedule ? "Annuler" : brief.instagram_status === "scheduled" ? "Modifier la programmation" : "Programmer…"}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--muted,#7A6E5C)", fontStyle: "italic" }}>
                    {!hasInstagramCreds
                      ? "Configurez Meta pour publier"
                      : "Ajoutez au moins une photo pour publier"}
                  </span>
                )}
              </div>

              {/* Panneau de programmation */}
              {showSchedule ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    background: "rgba(184,151,90,0.10)",
                    border: "1px solid rgba(184,151,90,0.28)",
                    borderRadius: 4,
                  }}
                >
                  <div className="agent-form-field" style={{ marginBottom: 10 }}>
                    <label>Date & heure de publication</label>
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                    />
                    <span className="agent-form-field__help">
                      Le cron passe toutes les 15 min — la publication se fera à l'occurrence suivante après cette heure.
                    </span>
                  </div>
                  <div className="agent-actions" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
                    <button
                      type="button"
                      className="agent-btn agent-btn--primary"
                      onClick={() =>
                        run(
                          () =>
                            scheduleInstagramAction(
                              brief.id,
                              new Date(scheduleAt).toISOString()
                            ),
                          "Post programmé."
                        )
                      }
                      disabled={pending}
                    >
                      Programmer
                    </button>
                  </div>
                </div>
              ) : null}

              {brief.instagram_status === "scheduled" && brief.instagram_scheduled_for ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    background: "rgba(224,185,106,0.10)",
                    border: "1px solid rgba(224,185,106,0.32)",
                    borderRadius: 4,
                    fontSize: 12.5,
                    color: "#E0B96A",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span>
                    📅 Programmé pour le{" "}
                    <strong>
                      {new Date(brief.instagram_scheduled_for).toLocaleString("fr-FR", {
                        dateStyle: "full",
                        timeStyle: "short",
                      })}
                    </strong>
                  </span>
                  <button
                    type="button"
                    className="agent-btn agent-btn--ghost"
                    style={{ marginLeft: "auto", fontSize: 10, padding: "6px 10px" }}
                    onClick={() =>
                      run(
                        () => cancelScheduledInstagramAction(brief.id),
                        "Programmation annulée."
                      )
                    }
                    disabled={pending}
                  >
                    Annuler
                  </button>
                </div>
              ) : null}

              {brief.instagram_post_id ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--muted,#7A6E5C)" }}>
                    ID post Instagram : <code>{brief.instagram_post_id}</code>
                  </div>
                  {/* Insights Meta */}
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      background: "rgba(0,0,0,0.18)",
                      border: "1px solid rgba(184,151,90,0.20)",
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      flexWrap: "wrap",
                    }}
                  >
                    <InsightMetric
                      label="Likes"
                      value={brief.instagram_insights?.likes}
                    />
                    <InsightMetric
                      label="Commentaires"
                      value={brief.instagram_insights?.comments}
                    />
                    <InsightMetric
                      label="Portée"
                      value={brief.instagram_insights?.reach}
                    />
                    <div style={{ flex: 1 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                      {brief.instagram_insights_fetched_at ? (
                        <div style={{ fontSize: 10, color: "rgba(244,239,227,0.55)" }}>
                          Rafraîchi{" "}
                          {new Date(
                            brief.instagram_insights_fetched_at
                          ).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="agent-btn agent-btn--ghost"
                        onClick={() =>
                          run(
                            () => refreshInstagramInsightsAction(brief.id),
                            "Insights actualisés."
                          )
                        }
                        disabled={pending}
                        style={{ fontSize: 10, padding: "6px 10px" }}
                      >
                        {pending ? "…" : "🔄 Rafraîchir insights"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ── LinkedIn ── */}
          {tab === "linkedin" ? (
            <div style={{ paddingTop: 22 }}>
              <div
                style={{
                  padding: 12,
                  background: "rgba(184,151,90,0.10)",
                  border: "1px solid rgba(184,151,90,0.28)",
                  color: "rgba(244,239,227,0.85)",
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  marginBottom: 18,
                  borderRadius: 4,
                }}
              >
                💡 LinkedIn ne permet pas la publication automatique pour les
                profils personnels. Éditez ci-dessous, copiez, ouvrez LinkedIn
                et collez. Cliquez « Copié + publié sur LinkedIn » quand c'est
                fait pour marquer.
              </div>
              <div className="agent-form-field">
                <label>Post LinkedIn</label>
                <textarea
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  style={{ minHeight: 260 }}
                />
                <span className="agent-form-field__help">
                  {linkedin.length} caractères
                </span>
              </div>
              <div className="agent-actions">
                <button
                  type="button"
                  className="agent-btn agent-btn--ghost"
                  onClick={() => savePlatform("linkedin")}
                  disabled={pending}
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="agent-btn agent-btn--primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(linkedin);
                      run(
                        () => markLinkedInCopiedAction(brief.id),
                        "Copié dans le presse-papiers + marqué comme copié."
                      );
                    } catch {
                      setFlash({
                        ok: false,
                        msg: "Copie impossible depuis ce navigateur",
                      });
                    }
                  }}
                  disabled={pending}
                >
                  Copier + marquer publié
                </button>
                <a
                  href="https://www.linkedin.com/feed/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="agent-btn agent-btn--ghost"
                  style={{ textDecoration: "none" }}
                >
                  Ouvrir LinkedIn →
                </a>
              </div>
            </div>
          ) : null}

          {/* ── Blog ── */}
          {tab === "blog" ? (
            <div style={{ paddingTop: 22 }}>
              <div className="agent-form-field">
                <label>Titre (SEO — 60 max)</label>
                <input
                  type="text"
                  value={blogTitle}
                  onChange={(e) => setBlogTitle(e.target.value)}
                />
                <span className="agent-form-field__help">
                  {blogTitle.length} caractères
                </span>
              </div>
              <div className="agent-form-field">
                <label>Slug URL</label>
                <input
                  type="text"
                  value={blogSlug}
                  onChange={(e) => setBlogSlug(e.target.value)}
                />
                <span className="agent-form-field__help">
                  Sera l'URL : /blog/{blogSlug || "..."}
                </span>
              </div>
              <div className="agent-form-field">
                <label>Méta-description (155 max)</label>
                <textarea
                  value={blogMeta}
                  onChange={(e) => setBlogMeta(e.target.value)}
                  style={{ minHeight: 60 }}
                />
                <span className="agent-form-field__help">
                  {blogMeta.length} caractères
                </span>
              </div>
              <div className="agent-form-field">
                <label>Contenu (Markdown)</label>
                <textarea
                  value={blogContent}
                  onChange={(e) => setBlogContent(e.target.value)}
                  style={{
                    minHeight: 320,
                    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                    fontSize: 12.5,
                    lineHeight: 1.55,
                  }}
                />
                <span className="agent-form-field__help">
                  ~{(blogContent.match(/\S+/g) || []).length} mots
                </span>
              </div>

              <div className="agent-actions">
                <button
                  type="button"
                  className="agent-btn agent-btn--ghost"
                  onClick={() => savePlatform("blog")}
                  disabled={pending}
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="agent-btn agent-btn--primary"
                  onClick={() =>
                    run(
                      () => publishBlogAction(brief.id),
                      "Brouillon blog créé — vérifiez dans /admin/posts."
                    )
                  }
                  disabled={pending || Boolean(brief.blog_post_id)}
                >
                  {brief.blog_post_id
                    ? "Brouillon déjà créé"
                    : "Créer le brouillon blog"}
                </button>
                {brief.blog_post_id ? (
                  <a
                    href={`/admin/posts`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="agent-btn agent-btn--ghost"
                    style={{ textDecoration: "none" }}
                  >
                    Ouvrir /admin/posts →
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Actions globales sur le brief */}
          <div
            className="agent-actions"
            style={{
              marginTop: 22,
              paddingTop: 18,
              borderTop: "1px solid rgba(184,151,90,0.18)",
            }}
          >
            <button
              type="button"
              className="agent-btn agent-btn--ghost"
              onClick={() =>
                run(
                  () => regenerateDraftsAction(brief.id),
                  "Drafts régénérés — rafraîchissez si besoin."
                )
              }
              disabled={pending}
            >
              Régénérer les 3 drafts
            </button>
            <button
              type="button"
              className="agent-btn agent-btn--danger"
              onClick={() => {
                if (confirm("Supprimer ce brief ?"))
                  run(
                    () => deleteBriefAction(brief.id),
                    "Brief supprimé."
                  );
              }}
              disabled={pending}
            >
              Supprimer
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function InsightMetric({ label, value }: { label: string; value: number | undefined }) {
  const isEmpty = value === undefined || value === null;
  return (
    <div style={{ textAlign: "center", minWidth: 60 }}>
      <div
        style={{
          fontFamily: "var(--serif, Georgia, serif)",
          fontStyle: "italic",
          fontSize: 20,
          color: isEmpty ? "rgba(244,239,227,0.35)" : "var(--gold-light, #D4B57A)",
          lineHeight: 1,
        }}
      >
        {isEmpty ? "—" : value.toLocaleString("fr-FR")}
      </div>
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(244,239,227,0.55)",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}
