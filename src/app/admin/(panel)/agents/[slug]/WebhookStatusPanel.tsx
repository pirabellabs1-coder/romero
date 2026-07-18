type Props = {
  config: Record<string, string>;
  origin: string;
};

// Affiche les endpoints webhook à copier vers Telegram et Meta, avec un
// indicateur de configuration prêt-ou-pas pour chaque canal.
export default function WebhookStatusPanel({ config, origin }: Props) {
  const telegramReady = Boolean(config.telegram_bot_token);
  const whatsappReady = Boolean(
    config.whatsapp_verify_token &&
      config.whatsapp_access_token &&
      config.whatsapp_phone_number_id
  );

  return (
    <>
      {/* Telegram */}
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <h2>Bot Telegram</h2>
        <div
          className={`agent-flash agent-flash--${telegramReady ? "ok" : "err"}`}
          style={{ marginBottom: 14 }}
        >
          {telegramReady
            ? "✓ Token configuré. Il ne reste qu'à pointer le webhook Telegram vers notre URL."
            : "⚠ Créez un bot via @BotFather sur Telegram et renseignez son token dans l'onglet Configuration."}
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(244,239,227,0.85)" }}>
          <strong style={{ display: "block", marginBottom: 6, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gold-light,#D4B57A)" }}>
            URL du webhook (à configurer côté Telegram)
          </strong>
          <code
            style={{
              display: "block",
              background: "rgba(0,0,0,0.28)",
              padding: "10px 12px",
              borderRadius: 3,
              fontSize: 12,
              wordBreak: "break-all",
              marginBottom: 14,
            }}
          >
            {origin}/api/telegram/webhook
          </code>

          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer", color: "var(--gold-light,#D4B57A)" }}>
              Étapes pour pointer le webhook
            </summary>
            <ol style={{ marginTop: 10, paddingLeft: 22 }}>
              <li>
                Ouvrez Telegram, cherchez <strong>@BotFather</strong>, envoyez{" "}
                <code>/newbot</code>. Choisissez un nom et un username (finissant par « bot »).
              </li>
              <li>
                Copiez le token qui apparaît (format{" "}
                <code>123456789:AAG...</code>) et collez-le dans l'onglet Configuration
                → <code>telegram_bot_token</code>.
              </li>
              <li>
                Enregistrez le webhook auprès de Telegram, une fois pour toutes,
                en exécutant depuis un terminal :
                <br />
                <code
                  style={{
                    display: "block",
                    background: "rgba(0,0,0,0.28)",
                    padding: "10px 12px",
                    borderRadius: 3,
                    fontSize: 12,
                    wordBreak: "break-all",
                    marginTop: 8,
                  }}
                >
                  curl &quot;https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url={origin}/api/telegram/webhook&quot;
                </code>
              </li>
              <li>
                Pour restreindre l'accès au bot à vous seul, renseignez{" "}
                <code>telegram_allowed_user_id</code> (obtenu via{" "}
                <strong>@userinfobot</strong>).
              </li>
              <li>Envoyez un message à votre bot pour tester.</li>
            </ol>
          </details>
        </div>
      </div>

      {/* WhatsApp */}
      <div className="agent-panel">
        <h2>WhatsApp Business (Meta Cloud API)</h2>
        <div
          className={`agent-flash agent-flash--${whatsappReady ? "ok" : "err"}`}
          style={{ marginBottom: 14 }}
        >
          {whatsappReady
            ? "✓ Configuration complète. Le webhook est prêt à recevoir des messages."
            : "⚠ Renseignez verify_token, access_token et phone_number_id dans l'onglet Configuration."}
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(244,239,227,0.85)" }}>
          <strong style={{ display: "block", marginBottom: 6, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gold-light,#D4B57A)" }}>
            Callback URL (à configurer côté Meta)
          </strong>
          <code
            style={{
              display: "block",
              background: "rgba(0,0,0,0.28)",
              padding: "10px 12px",
              borderRadius: 3,
              fontSize: 12,
              wordBreak: "break-all",
              marginBottom: 14,
            }}
          >
            {origin}/api/whatsapp/webhook
          </code>

          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer", color: "var(--gold-light,#D4B57A)" }}>
              Étapes de configuration Meta
            </summary>
            <ol style={{ marginTop: 10, paddingLeft: 22 }}>
              <li>
                Créer un compte Meta Business sur{" "}
                <a
                  href="https://business.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--gold-light,#D4B57A)" }}
                >
                  business.facebook.com
                </a>.
              </li>
              <li>
                Dans{" "}
                <a
                  href="https://developers.facebook.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--gold-light,#D4B57A)" }}
                >
                  developers.facebook.com/apps
                </a>{" "}
                → Create App → Business → ajouter le produit « WhatsApp ».
              </li>
              <li>
                Onglet WhatsApp → Getting Started → ajouter un numéro (celui-ci
                ne doit PAS être déjà utilisé sur WhatsApp personnel).
              </li>
              <li>
                Copier le <strong>Phone Number ID</strong> et l'
                <strong>Access Token</strong> temporaire (à remplacer plus tard
                par un System User Token permanent).
              </li>
              <li>
                Onglet WhatsApp → Configuration → Webhook. Coller la Callback
                URL ci-dessus et le <strong>verify token</strong> que vous
                choisissez. S'abonner au champ <code>messages</code>.
              </li>
              <li>Envoyer un message à votre numéro WhatsApp Business pour tester.</li>
            </ol>
          </details>
        </div>
      </div>
    </>
  );
}
