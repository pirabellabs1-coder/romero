"use client";
import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateReplyForContactAction } from "./actions";

export type UnifiedThread = {
  id: string;
  channel: "contact" | "chatbot" | "whatsapp" | "telegram";
  contactName: string;
  contactId?: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unread: boolean;
  messageCount: number;
  extra?: Record<string, unknown>;
};

export type ThreadMessage = {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  createdAt: string;
};

type Channel = "all" | "contact" | "chatbot" | "whatsapp" | "telegram";

const CHANNELS: Array<{ key: Channel; label: string; color: string; icon: string }> = [
  { key: "all", label: "Tous", color: "#B8975A", icon: "◈" },
  { key: "contact", label: "Contact", color: "#E4C58A", icon: "✉" },
  { key: "chatbot", label: "Site", color: "#9DB29A", icon: "◉" },
  { key: "whatsapp", label: "WhatsApp", color: "#25D366", icon: "◎" },
  { key: "telegram", label: "Telegram", color: "#3EC8F5", icon: "◐" },
];

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function channelMeta(ch: UnifiedThread["channel"]) {
  return CHANNELS.find((c) => c.key === ch) ?? CHANNELS[0];
}

export default function Inbox({
  threads,
  openThread,
  openMessages,
  initialChannel,
  initialQuery,
}: {
  threads: UnifiedThread[];
  openThread?: UnifiedThread;
  openMessages: ThreadMessage[];
  initialChannel: Channel;
  initialQuery: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [q, setQ] = useState(initialQuery);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return threads.filter((t) => {
      if (channel !== "all" && t.channel !== channel) return false;
      if (!ql) return true;
      return (
        t.contactName.toLowerCase().includes(ql) ||
        (t.contactId ?? "").toLowerCase().includes(ql) ||
        t.lastMessagePreview.toLowerCase().includes(ql)
      );
    });
  }, [threads, channel, q]);

  const counts = useMemo(() => {
    const c: Record<Channel, { total: number; unread: number }> = {
      all: { total: threads.length, unread: 0 },
      contact: { total: 0, unread: 0 },
      chatbot: { total: 0, unread: 0 },
      whatsapp: { total: 0, unread: 0 },
      telegram: { total: 0, unread: 0 },
    };
    for (const t of threads) {
      c[t.channel].total++;
      if (t.unread) {
        c[t.channel].unread++;
        c.all.unread++;
      }
    }
    return c;
  }, [threads]);

  function openThreadHref(id: string): string {
    const p = new URLSearchParams(params?.toString() ?? "");
    p.set("open", id);
    return `/admin/inbox?${p.toString()}`;
  }

  function changeChannel(next: Channel) {
    setChannel(next);
    const p = new URLSearchParams(params?.toString() ?? "");
    if (next === "all") p.delete("ch");
    else p.set("ch", next);
    p.delete("open");
    router.push(`/admin/inbox?${p.toString()}`);
  }

  return (
    <div>
      <section className="agents-hero" style={{ marginBottom: 22 }}>
        <div className="agents-hero__eyebrow">Inbox unifié</div>
        <h1 className="agents-hero__title">
          Toutes tes <em>conversations</em>
        </h1>
        <p className="agents-hero__lead">
          Formulaires de contact, chatbot du site, WhatsApp, Telegram — tout arrive ici,
          trié par date. Clique une conversation pour voir le fil complet.
        </p>
      </section>

      {/* Filtres canaux */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {CHANNELS.map((c) => {
          const active = channel === c.key;
          const badge = counts[c.key];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => changeChannel(c.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 4,
                border: `1px solid ${active ? c.color : "rgba(184,151,90,0.25)"}`,
                background: active ? `${c.color}22` : "transparent",
                color: active ? c.color : "rgba(244,239,227,0.8)",
                cursor: "pointer",
                fontSize: 12.5,
                letterSpacing: "0.04em",
              }}
            >
              <span style={{ color: c.color, fontSize: 12 }}>{c.icon}</span>
              <span>{c.label}</span>
              <span
                style={{
                  fontSize: 10,
                  opacity: 0.6,
                  padding: "2px 6px",
                  borderRadius: 10,
                  background: "rgba(184,151,90,0.14)",
                }}
              >
                {badge.total}
              </span>
              {badge.unread > 0 ? (
                <span
                  style={{
                    fontSize: 9,
                    color: "#B8975A",
                    padding: "2px 6px",
                    borderRadius: 10,
                    background: "rgba(184,151,90,0.25)",
                    fontWeight: 600,
                  }}
                >
                  {badge.unread} non lu
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Recherche */}
      <input
        type="search"
        placeholder="🔍 Rechercher par nom, email ou contenu…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 4,
          background: "rgba(0,0,0,0.15)",
          border: "1px solid rgba(184,151,90,0.2)",
          color: "rgba(244,239,227,0.9)",
          fontSize: 13,
          marginBottom: 14,
          outline: "none",
        }}
      />

      {/* Layout 2 colonnes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 380px) 1fr",
          gap: 16,
          minHeight: 500,
        }}
      >
        {/* Liste */}
        <div
          className="agent-panel"
          style={{
            padding: 0,
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: 20, opacity: 0.55, textAlign: "center", fontStyle: "italic" }}>
              Aucune conversation dans ce canal.
            </div>
          ) : (
            filtered.map((t) => {
              const cm = channelMeta(t.channel);
              const isOpen = openThread?.id === t.id;
              return (
                <Link
                  key={t.id}
                  href={openThreadHref(t.id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "14px 16px",
                    borderBottom: "1px solid rgba(184,151,90,0.08)",
                    background: isOpen ? "rgba(184,151,90,0.08)" : "transparent",
                    textDecoration: "none",
                    color: "inherit",
                    borderLeft: isOpen ? `3px solid ${cm.color}` : "3px solid transparent",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: t.unread ? cm.color : "transparent",
                      marginTop: 8,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong
                        style={{
                          fontSize: 13.5,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: t.unread ? "#F4EFE3" : "rgba(244,239,227,0.75)",
                        }}
                      >
                        {t.contactName}
                      </strong>
                      <span style={{ fontSize: 10.5, opacity: 0.55, whiteSpace: "nowrap" }}>
                        {timeAgo(t.lastMessageAt)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: cm.color,
                          fontWeight: 600,
                        }}
                      >
                        {cm.icon} {cm.label}
                      </span>
                      <span style={{ fontSize: 10.5, opacity: 0.5 }}>· {t.messageCount} msg</span>
                    </div>
                    {t.lastMessagePreview ? (
                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.65,
                          marginTop: 4,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {t.lastMessagePreview}
                      </div>
                    ) : null}
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Thread ouvert */}
        <div className="agent-panel" style={{ minHeight: 500 }}>
          {!openThread ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 400,
                opacity: 0.5,
                fontStyle: "italic",
                textAlign: "center",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 32 }}>✉</div>
              <div>Sélectionne une conversation à gauche</div>
            </div>
          ) : (
            <ThreadPanel thread={openThread} messages={openMessages} />
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadPanel({
  thread,
  messages,
}: {
  thread: UnifiedThread;
  messages: ThreadMessage[];
}) {
  const cm = channelMeta(thread.channel);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  const canAskAI = thread.channel === "contact";
  const contactNumericId = canAskAI
    ? parseInt(thread.id.replace(/^contact_/, ""), 10)
    : NaN;

  function askAI() {
    if (!Number.isFinite(contactNumericId)) return;
    setFlash(null);
    startTransition(async () => {
      const res = await generateReplyForContactAction(contactNumericId);
      if (res.ok) {
        setFlash({
          ok: true,
          msg: `Brouillon IA envoyé sur Telegram (#${res.approvalId}). Valide-le en 1 tap.`,
        });
      } else {
        setFlash({ ok: false, msg: res.error });
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingBottom: 14,
          borderBottom: "1px solid rgba(184,151,90,0.15)",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: cm.color,
              marginBottom: 4,
            }}
          >
            {cm.icon} {cm.label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{thread.contactName}</div>
          {thread.contactId ? (
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>{thread.contactId}</div>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {canAskAI ? (
            <button
              type="button"
              onClick={askAI}
              disabled={pending}
              className="agent-btn agent-btn--primary"
              style={{ fontSize: 12, whiteSpace: "nowrap" }}
              title="L'IA rédige une réponse et te l'envoie sur Telegram pour validation en 1 tap"
            >
              {pending ? "…" : "✨ Répondre par IA"}
            </button>
          ) : null}
          <div style={{ fontSize: 11, opacity: 0.55, whiteSpace: "nowrap" }}>
            {new Date(thread.lastMessageAt).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      {flash ? (
        <div
          className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`}
          style={{ marginTop: -4 }}
        >
          {flash.ok ? "✓" : "✗"} {flash.msg}
        </div>
      ) : null}

      {/* Messages */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxHeight: "55vh",
          overflowY: "auto",
          padding: "4px 2px",
        }}
      >
        {messages.length === 0 ? (
          <div style={{ opacity: 0.55, fontStyle: "italic", textAlign: "center", padding: 20 }}>
            Aucun message dans ce fil.
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} m={m} channelColor={cm.color} />
          ))
        )}
      </div>

      {/* Footer avec métadonnées éventuelles */}
      {thread.extra ? <MetaFooter extra={thread.extra} channel={thread.channel} /> : null}
    </div>
  );
}

function MessageBubble({ m, channelColor }: { m: ThreadMessage; channelColor: string }) {
  const isUser = m.role === "user";
  const isSystem = m.role === "system";
  const isTool = m.role === "tool";

  if (isSystem) {
    return (
      <div
        style={{
          padding: "8px 12px",
          background: "rgba(184,151,90,0.06)",
          border: "1px dashed rgba(184,151,90,0.2)",
          borderRadius: 4,
          fontSize: 12,
          opacity: 0.75,
          whiteSpace: "pre-wrap",
          fontStyle: "italic",
        }}
      >
        {m.content}
      </div>
    );
  }

  const time = new Date(m.createdAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-start" : "flex-end",
      }}
    >
      <div
        style={{
          maxWidth: "78%",
          padding: "10px 14px",
          borderRadius: 8,
          background: isUser
            ? "rgba(184,151,90,0.12)"
            : isTool
            ? "rgba(157,178,154,0.14)"
            : `${channelColor}22`,
          border: `1px solid ${isUser ? "rgba(184,151,90,0.25)" : channelColor + "44"}`,
          fontSize: 13.5,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            opacity: 0.55,
            marginBottom: 4,
          }}
        >
          {isUser ? "Utilisateur" : isTool ? "Outil" : "Assistant"} · {time}
        </div>
        {m.content}
      </div>
    </div>
  );
}

function MetaFooter({
  extra,
  channel,
}: {
  extra: Record<string, unknown>;
  channel: UnifiedThread["channel"];
}) {
  if (channel === "chatbot" && extra.lead_data && typeof extra.lead_data === "object") {
    const ld = extra.lead_data as Record<string, unknown>;
    const items = Object.entries(ld).filter(
      ([, v]) => typeof v === "string" && (v as string).trim() !== ""
    );
    if (items.length === 0) return null;
    return (
      <div
        style={{
          paddingTop: 12,
          borderTop: "1px solid rgba(184,151,90,0.15)",
        }}
      >
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: 0.55,
            marginBottom: 8,
          }}
        >
          Info du lead
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 12 }}>
          {items.map(([k, v]) => (
            <Fragment key={k}>
              <div style={{ opacity: 0.55, textTransform: "capitalize" }}>
                {k.replace(/_/g, " ")}
              </div>
              <div style={{ color: "rgba(244,239,227,0.85)" }}>{String(v)}</div>
            </Fragment>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
