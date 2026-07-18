import { listBriefsForAdmin } from "../marketing-actions";
import BriefComposer from "./BriefComposer";
import BriefCard from "./BriefCard";

type Props = {
  activeBriefId?: number;
  hasClaudeKey: boolean;
  hasWhisperKey: boolean;
  hasInstagramCreds: boolean;
};

export default async function MarketingBriefsView({
  activeBriefId,
  hasClaudeKey,
  hasWhisperKey,
  hasInstagramCreds,
}: Props) {
  const briefs = await listBriefsForAdmin(40).catch(() => []);

  return (
    <div className="agent-detail">
      <div style={{ gridColumn: "1 / -1" }}>
        {/* Composer */}
        {hasClaudeKey ? (
          <BriefComposer allowVoice={hasWhisperKey} />
        ) : (
          <div className="agent-panel" style={{ marginBottom: 22 }}>
            <div className="agent-flash agent-flash--err">
              Configurez d'abord votre clé API Anthropic dans l'onglet
              Configuration pour générer des posts.
            </div>
          </div>
        )}

        {/* Liste des briefs existants */}
        {briefs.length === 0 ? (
          <div className="agent-panel">
            <p style={{ opacity: 0.6, fontStyle: "italic" }}>
              Aucun brief pour l'instant. Envoyez votre premier plus haut pour
              générer 3 drafts (Instagram, LinkedIn, blog) en une fois.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {briefs.map((b) => (
              <BriefCard
                key={b.id}
                brief={b}
                defaultOpen={activeBriefId === b.id}
                hasInstagramCreds={hasInstagramCreds}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
