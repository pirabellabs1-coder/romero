import { query } from "@/lib/db";

type Session = {
  id: number;
  platform: "telegram" | "whatsapp";
  platform_user_id: string;
  display_name: string | null;
  message_count: number;
  updated_at: string;
  last_user: string | null;
  last_assistant: string | null;
};

type Message = {
  id: number;
  role: string;
  content: string;
  created_at: string;
};

type Props = { activeSessionId?: number };

export default async function WhatsappSessionsView({ activeSessionId }: Props) {
  const sessions = await query<Session>(
    `SELECT s.id, s.platform, s.platform_user_id, s.display_name, s.message_count, s.updated_at,
            (SELECT content FROM assistant_messages WHERE session_id = s.id AND role = 'user' ORDER BY id DESC LIMIT 1) AS last_user,
            (SELECT content FROM assistant_messages WHERE session_id = s.id AND role = 'assistant' ORDER BY id DESC LIMIT 1) AS last_assistant
     FROM assistant_sessions s
     ORDER BY s.updated_at DESC
     LIMIT 40`
  ).catch(() => [] as Session[]);

  const messages = activeSessionId
    ? await query<Message>(
        `SELECT id, role, content, created_at
         FROM assistant_messages
         WHERE session_id = $1 AND role IN ('user','assistant')
         ORDER BY id ASC`,
        [activeSessionId]
      ).catch(() => [] as Message[])
    : [];

  return (
    <div className="agent-detail">
      <div className="agent-panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Sessions Telegram / WhatsApp</h2>
        <p style={{ marginTop: -6, marginBottom: 20 }}>
          Chaque session correspond à un utilisateur (idéalement, vous seul).
          Le compteur inclut messages user + assistant (hors tool calls).
        </p>

        {sessions.length === 0 ? (
          <p style={{ opacity: 0.55, fontStyle: "italic" }}>
            Aucune session enregistrée. Envoyez votre premier message à votre
            bot Telegram ou à votre numéro WhatsApp Business pour tester.
          </p>
        ) : (
          <table className="agent-stats-table" style={{ marginBottom: 24 }}>
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>Canal</th>
                <th>Utilisateur</th>
                <th>Dernier échange</th>
                <th style={{ textAlign: "center" }}>Msg</th>
                <th>Activité</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  style={
                    activeSessionId === s.id
                      ? {
                          background: "rgba(184,151,90,0.10)",
                          outline: "1px solid rgba(184,151,90,0.35)",
                        }
                      : undefined
                  }
                >
                  <td>
                    <a
                      href={`/admin/agents/whatsapp?tab=sessions&sess=${s.id}`}
                      style={{ color: "var(--gold-light,#D4B57A)" }}
                    >
                      {s.id}
                    </a>
                  </td>
                  <td>
                    <span
                      className={`agent-badge agent-badge--${s.platform === "telegram" ? "not-installed" : "installed"}`}
                      style={{ padding: "3px 8px", fontSize: 9 }}
                    >
                      {s.platform}
                    </span>
                  </td>
                  <td>{s.display_name || s.platform_user_id}</td>
                  <td style={{ fontSize: 12, opacity: 0.85, maxWidth: 240 }}>
                    <div
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.last_user || "—"}
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>{s.message_count}</td>
                  <td style={{ fontSize: 12, opacity: 0.7 }}>
                    {new Date(s.updated_at).toLocaleString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeSessionId && messages.length > 0 ? (
          <div
            style={{
              padding: 20,
              background: "rgba(0,0,0,0.2)",
              border: "1px solid rgba(184,151,90,0.25)",
              borderRadius: 6,
            }}
          >
            <h2>Transcript — session {activeSessionId}</h2>
            <div className="agent-pg-history">
              {messages.map((m) => (
                <div key={m.id} className="agent-pg-turn" style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span
                      className={`agent-badge agent-badge--${m.role === "user" ? "not-installed" : "installed"}`}
                      style={{ padding: "3px 8px", fontSize: 9 }}
                    >
                      {m.role === "user" ? "Vous" : "Assistant"}
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.55 }}>
                      {new Date(m.created_at).toLocaleString("fr-FR")}
                    </span>
                  </div>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      color: "rgba(244,239,227,0.9)",
                    }}
                  >
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
