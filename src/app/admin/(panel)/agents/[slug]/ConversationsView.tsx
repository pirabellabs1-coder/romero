import Link from "next/link";
import {
  listConversations,
  listMessages,
  getConversationById,
} from "@/lib/site-chat";

type Props = { activeConvId?: number };

export default async function ConversationsView({ activeConvId }: Props) {
  const conversations = await listConversations(80).catch(() => []);
  const activeConv =
    activeConvId && conversations.find((c) => c.id === activeConvId)
      ? await getConversationById(activeConvId).catch(() => null)
      : null;
  const activeMessages = activeConv
    ? await listMessages(activeConv.id).catch(() => [])
    : [];

  return (
    <div className="agent-detail">
      <div className="agent-panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Conversations du chatbot public</h2>
        <p style={{ marginTop: -6, marginBottom: 22 }}>
          Chaque session visiteur qui a échangé avec l'assistant. Les
          conversations marquées <em>Lead envoyé</em> ont déclenché un
          e-mail récap. Cliquez sur une ligne pour lire le transcript.
        </p>

        {conversations.length === 0 ? (
          <p style={{ opacity: 0.55, fontStyle: "italic" }}>
            Aucune conversation pour le moment. Dès qu'un visiteur ouvre le
            widget de chat sur romerophotography.fr, il apparaîtra ici.
          </p>
        ) : (
          <table className="agent-stats-table" style={{ marginBottom: 30 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Prospect</th>
                <th>Contact</th>
                <th>Mariage</th>
                <th style={{ textAlign: "center" }}>Msg</th>
                <th>Statut</th>
                <th>Dernière activité</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((c) => {
                const lead = c.lead_data as Record<string, string>;
                return (
                  <tr
                    key={c.id}
                    style={
                      activeConvId === c.id
                        ? {
                            background: "rgba(184,151,90,0.10)",
                            outline: "1px solid rgba(184,151,90,0.35)",
                          }
                        : undefined
                    }
                  >
                    <td>
                      <Link
                        href={`/admin/agents/site?tab=conversations&conv=${c.id}`}
                        style={{ color: "var(--gold-light, #D4B57A)" }}
                      >
                        {c.id}
                      </Link>
                    </td>
                    <td>{lead.contact_name || "—"}</td>
                    <td>
                      {lead.contact_email ? (
                        <div style={{ fontSize: 12 }}>
                          {lead.contact_email}
                          {lead.contact_phone ? (
                            <div style={{ opacity: 0.6 }}>{lead.contact_phone}</div>
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {lead.wedding_date || lead.wedding_location ? (
                        <div style={{ fontSize: 12 }}>
                          {lead.wedding_date}
                          {lead.wedding_location ? (
                            <div style={{ opacity: 0.6 }}>{lead.wedding_location}</div>
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>{c.message_count}</td>
                    <td>
                      <span
                        className={`agent-badge agent-badge--${c.notified ? "installed" : "not-installed"}`}
                        style={{ padding: "3px 8px", fontSize: 9 }}
                      >
                        {c.notified ? "Lead envoyé" : "Ouverte"}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, opacity: 0.75 }}>
                      {new Date(c.updated_at).toLocaleString("fr-FR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Détail d'une conversation */}
        {activeConv ? (
          <div style={{ marginTop: 20, padding: 20, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(184,151,90,0.25)", borderRadius: 6 }}>
            <h2>Conversation {activeConv.id}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 20 }}>
              <MiniField label="Nom" value={activeConv.lead_data.contact_name} />
              <MiniField label="E-mail" value={activeConv.lead_data.contact_email} />
              <MiniField label="Téléphone" value={activeConv.lead_data.contact_phone} />
              <MiniField label="Date" value={activeConv.lead_data.wedding_date} />
              <MiniField label="Lieu" value={activeConv.lead_data.wedding_location} />
              <MiniField label="Invités" value={activeConv.lead_data.guest_count as unknown as string} />
              <MiniField label="Formule" value={activeConv.lead_data.preferred_formula} />
              <MiniField label="Budget" value={activeConv.lead_data.budget_range} />
            </div>
            {activeConv.lead_data.style_notes ? (
              <div style={{ marginBottom: 20, padding: 12, background: "rgba(0,0,0,0.2)", borderLeft: "2px solid var(--gold, #B8975A)", fontSize: 13, color: "rgba(244,239,227,0.85)" }}>
                <strong style={{ display: "block", marginBottom: 4, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--gold-light, #D4B57A)" }}>
                  Notes de style
                </strong>
                {activeConv.lead_data.style_notes}
              </div>
            ) : null}

            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Transcript</h2>
            <div className="agent-pg-history">
              {activeMessages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m) => (
                  <div key={m.id} className="agent-pg-turn" style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span
                        className={`agent-badge agent-badge--${m.role === "user" ? "not-installed" : "installed"}`}
                        style={{ padding: "3px 8px", fontSize: 9 }}
                      >
                        {m.role === "user" ? "Visiteur" : "Assistant"}
                      </span>
                      <span style={{ fontSize: 11, opacity: 0.55 }}>
                        {new Date(m.created_at).toLocaleString("fr-FR")}
                      </span>
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6, color: "rgba(244,239,227,0.9)" }}>
                      {m.content}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MiniField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.15)", borderRadius: 4, border: "1px solid rgba(184,151,90,0.15)" }}>
      <div style={{ fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(244,239,227,0.55)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: value ? "#F4EFE3" : "rgba(244,239,227,0.4)" }}>
        {value || "—"}
      </div>
    </div>
  );
}
