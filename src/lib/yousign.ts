// ──────────────────────────────────────────────────────────────────────
// Yousign API v3 — signature électronique
// ──────────────────────────────────────────────────────────────────────
//
// Wrapper minimal pour :
//   - Créer une signature request
//   - Uploader le PDF à signer
//   - Ajouter le(s) signataire(s)
//   - Activer la request (envoie l'e-mail au signataire)
//   - Poller le statut
//   - Télécharger le PDF signé
//
// Doc : https://developers.yousign.com/reference (v3, JSON)
//
// Environments :
//   sandbox    : https://api-sandbox.yousign.app
//   production : https://api.yousign.app

export type YousignEnv = "sandbox" | "production";

function base(env: YousignEnv): string {
  return env === "production"
    ? "https://api.yousign.app"
    : "https://api-sandbox.yousign.app";
}

// ─── Types ────────────────────────────────────────────────────────
export type YousignSignatureRequest = {
  id: string;
  name: string;
  delivery_mode: "email" | "none";
  status: "draft" | "ongoing" | "done" | "canceled" | "expired" | "declined";
  ordered_signers: boolean;
  created_at: string;
};

export type YousignSigner = {
  id: string;
  status: string;
  info: { email: string; first_name: string; last_name: string; phone_number?: string };
};

export type YousignError = string;
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: YousignError };

async function yFetch<T>(
  env: YousignEnv,
  apiKey: string,
  path: string,
  init: RequestInit & { rawFormData?: FormData }
): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
      ...(init.headers as Record<string, string>),
    };
    // Ne pas définir content-type si on envoie du FormData (le browser
    // ajoute le boundary).
    if (!init.rawFormData) headers["content-type"] = "application/json";

    const resp = await fetch(`${base(env)}${path}`, {
      method: init.method || "GET",
      headers,
      body: init.rawFormData ?? init.body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `HTTP ${resp.status} · ${text.slice(0, 300)}` };
    }
    return { ok: true, data: (await resp.json()) as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Étape 1 : créer la signature request ─────────────────────────
export async function createSignatureRequest(input: {
  env: YousignEnv;
  apiKey: string;
  name: string;
  deliveryMode?: "email" | "none";
  timezone?: string;
}): Promise<ApiResult<YousignSignatureRequest>> {
  return yFetch<YousignSignatureRequest>(input.env, input.apiKey, "/v3/signature_requests", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      delivery_mode: input.deliveryMode ?? "email",
      timezone: input.timezone ?? "Europe/Paris",
    }),
  });
}

// ─── Étape 2 : uploader le PDF ────────────────────────────────────
export async function uploadDocument(input: {
  env: YousignEnv;
  apiKey: string;
  signatureRequestId: string;
  pdfBytes: Uint8Array;
  filename: string;
}): Promise<ApiResult<{ id: string; name: string; nature: string }>> {
  const form = new FormData();
  form.append("nature", "signable_document");
  form.append(
    "file",
    new Blob([input.pdfBytes], { type: "application/pdf" }),
    input.filename
  );
  return yFetch(
    input.env,
    input.apiKey,
    `/v3/signature_requests/${input.signatureRequestId}/documents`,
    { method: "POST", rawFormData: form }
  );
}

// ─── Étape 3 : ajouter un signataire ──────────────────────────────
export async function addSigner(input: {
  env: YousignEnv;
  apiKey: string;
  signatureRequestId: string;
  documentId: string;
  signer: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
  };
  signatureLevel?: "electronic_signature" | "advanced_electronic_signature";
  signatureAuthenticationMode?: "no_otp" | "otp_email" | "otp_sms";
}): Promise<ApiResult<YousignSigner>> {
  return yFetch<YousignSigner>(
    input.env,
    input.apiKey,
    `/v3/signature_requests/${input.signatureRequestId}/signers`,
    {
      method: "POST",
      body: JSON.stringify({
        info: {
          first_name: input.signer.first_name,
          last_name: input.signer.last_name,
          email: input.signer.email,
          phone_number: input.signer.phone_number,
          locale: "fr",
        },
        signature_level: input.signatureLevel ?? "electronic_signature",
        signature_authentication_mode:
          input.signatureAuthenticationMode ?? "no_otp",
        // Bloc signature : placé EXPLICITEMENT sur la page 1 à coordonnées
        // fixes. Yousign ne déduit pas la dernière page — le champ apparaît
        // donc bien sur la première page. Pour cibler la dernière page réelle
        // il faudrait parser le PDF en amont (non implémenté pour l'instant).
        fields: [
          {
            document_id: input.documentId,
            type: "signature",
            page: 1, // page explicite (1re page du PDF)
            x: 400,
            y: 700,
          },
        ],
      }),
    }
  );
}

// ─── Étape 4 : activer (envoie l'e-mail) ──────────────────────────
export async function activateSignatureRequest(input: {
  env: YousignEnv;
  apiKey: string;
  signatureRequestId: string;
}): Promise<ApiResult<YousignSignatureRequest>> {
  return yFetch<YousignSignatureRequest>(
    input.env,
    input.apiKey,
    `/v3/signature_requests/${input.signatureRequestId}/activate`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

// ─── Statut + signed download ─────────────────────────────────────
export async function getSignatureRequest(input: {
  env: YousignEnv;
  apiKey: string;
  signatureRequestId: string;
}): Promise<ApiResult<YousignSignatureRequest>> {
  return yFetch<YousignSignatureRequest>(
    input.env,
    input.apiKey,
    `/v3/signature_requests/${input.signatureRequestId}`,
    { method: "GET" }
  );
}

// Renvoie le PDF signé en Uint8Array (à uploader sur Supabase ou servir directement).
export async function downloadSignedDocument(input: {
  env: YousignEnv;
  apiKey: string;
  signatureRequestId: string;
}): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: string }> {
  try {
    const resp = await fetch(
      `${base(input.env)}/v3/signature_requests/${input.signatureRequestId}/documents/download`,
      { headers: { authorization: `Bearer ${input.apiKey}` } }
    );
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `HTTP ${resp.status} · ${text.slice(0, 300)}` };
    }
    return { ok: true, bytes: new Uint8Array(await resp.arrayBuffer()) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Flow tout-en-un ──────────────────────────────────────────────
// Prend un PDF + un signataire, renvoie l'ID de la signature request
// une fois activée. Le signataire recevra un e-mail Yousign.
export async function sendPdfToSign(input: {
  env: YousignEnv;
  apiKey: string;
  pdfBytes: Uint8Array;
  filename: string;
  documentName: string;
  signer: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
  };
}): Promise<
  | { ok: true; signatureRequestId: string }
  | { ok: false; error: string }
> {
  const create = await createSignatureRequest({
    env: input.env,
    apiKey: input.apiKey,
    name: input.documentName,
  });
  if (!create.ok) return { ok: false, error: `Création : ${create.error}` };

  const upload = await uploadDocument({
    env: input.env,
    apiKey: input.apiKey,
    signatureRequestId: create.data.id,
    pdfBytes: input.pdfBytes,
    filename: input.filename,
  });
  if (!upload.ok) return { ok: false, error: `Upload : ${upload.error}` };

  const signer = await addSigner({
    env: input.env,
    apiKey: input.apiKey,
    signatureRequestId: create.data.id,
    documentId: upload.data.id,
    signer: input.signer,
  });
  if (!signer.ok) return { ok: false, error: `Signataire : ${signer.error}` };

  const activate = await activateSignatureRequest({
    env: input.env,
    apiKey: input.apiKey,
    signatureRequestId: create.data.id,
  });
  if (!activate.ok) return { ok: false, error: `Activation : ${activate.error}` };

  // Un HTTP 200 ne garantit pas à lui seul l'envoi effectif : on exige que
  // la request soit bien passée en "ongoing" avant de la considérer envoyée.
  if (activate.data.status !== "ongoing") {
    return {
      ok: false,
      error: `Activation : statut inattendu "${activate.data.status}" (attendu "ongoing")`,
    };
  }

  return { ok: true, signatureRequestId: create.data.id };
}
