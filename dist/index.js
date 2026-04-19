import { z } from 'zod';
import { sha256 } from '@noble/hashes/sha2.js';
import '@noble/ed25519';

// ../numkeys-protocol/src/index.ts
var NUMKEYS_PROTOCOL_VERSION = "1.2";
var WALLET_SDK_CONTRACT_VERSION = "wallet-sdk/v2";
var enc = new TextEncoder();
function bytesToB64Url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64UrlToBytes(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - s.length % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToHex(bytes) {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}
function normalizePhone(e164) {
  return e164.replace(/[^0-9]/g, "");
}
function phoneHash(e164) {
  const digits = normalizePhone(e164);
  const h = sha256(enc.encode(digits));
  return `sha256:${bytesToHex(h)}`;
}
var AttestationClaimsSchema = z.object({
  iss: z.string(),
  sub: z.string(),
  iat: z.number(),
  jti: z.string(),
  phone_hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  user_pubkey: z.string(),
  binding_proof: z.string().regex(/^sig:/),
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  // `mode` is a Numkeys-specific claim added by orchestrators that need to
  // distinguish demo vs live attestations without parsing the iss domain.
  // Optional because the upstream Rust numkeys-node binary doesn't emit it
  // yet — verifiers should treat iss as the authoritative mode signal:
  // `numkeys.com` ⇒ live, `demo.numkeys.com` ⇒ demo.
  mode: z.enum(["demo", "live"]).optional()
});
function parseAttestation(jwt) {
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    throw new ProtocolError("invalid_attestation_format", "JWT must have 3 parts");
  }
  const [h, p, s] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64UrlToBytes(h)));
    payload = JSON.parse(new TextDecoder().decode(b64UrlToBytes(p)));
  } catch {
    throw new ProtocolError("invalid_attestation_format", "Invalid base64url JSON");
  }
  if (header.alg !== "EdDSA") {
    throw new ProtocolError("invalid_attestation_format", `Unsupported alg: ${header.alg}`);
  }
  const claims = AttestationClaimsSchema.parse(payload);
  const signature = b64UrlToBytes(s);
  const signingInput = enc.encode(`${h}.${p}`);
  return { raw: jwt, header, claims, signature, signingInput };
}
z.object({
  proxy_number: z.string(),
  service_id: z.string(),
  challenge_nonce: z.string().regex(/^[0-9a-f]{32}$/),
  verification_id: z.string(),
  expires_at: z.number(),
  callback_url: z.string().url().nullable().optional()
});
z.object({
  service_id: z.string(),
  challenge_nonce: z.string(),
  response_nonce: z.string(),
  verification_id: z.string(),
  timestamp: z.number()
});
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}
var ProtocolError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "ProtocolError";
  }
};
var IssuanceModeSchema = z.enum(["demo", "live"]);
var SessionStateSchema = z.enum([
  "pending",
  "phone_pending",
  "phone_verified",
  "payment_pending",
  "paid",
  // Transient claim state — set atomically when finalize() begins minting,
  // released to "finalized" on success or "failed" on error. Exists solely
  // so concurrent finalize requests can't double-issue.
  "issuing",
  "finalized",
  "failed",
  "expired"
]);
z.object({
  mode: IssuanceModeSchema,
  scope: z.string().regex(/^\d{1,4}$/, "scope must be 1-4 digit country code"),
  user_pubkey: z.string().min(1),
  phone_e164: z.string().regex(/^\+[1-9]\d{6,14}$/, "must be E.164")
});
z.object({
  code: z.string().min(4)
});
z.object({
  id: z.string().uuid(),
  state: SessionStateSchema,
  mode: IssuanceModeSchema,
  scope: z.string(),
  user_pubkey: z.string(),
  proxy_number: z.string().nullable(),
  attestation: z.string().nullable(),
  payment_required: z.boolean(),
  payment_status: z.string().nullable(),
  payment: z.object({
    // Vendor identifier intentionally omitted from the public view —
    // operators may swap providers without leaking the choice to the
    // wallet. The wallet only needs the rails it must render (BOLT11
    // and/or hosted checkout URL) and the price.
    amount_usd: z.string(),
    checkout_url: z.string().nullable(),
    lightning_invoice: z.string().nullable()
  }).nullable().optional(),
  error: z.string().nullable(),
  created_at: z.string()
});
z.object({
  issuer: z.string(),
  /** Allow-list of acceptable `iss` values served by this issuer key
   * (e.g. ["numkeys.com", "demo.numkeys.com"]). Optional for backward
   * compatibility; clients should fall back to [`issuer`]. */
  issuers: z.array(z.string()).optional(),
  public_key: z.string(),
  alg: z.literal("EdDSA")
});
z.object({
  /** The canonical issuer hostname this server is currently signing as. */
  issuer_domain: z.string(),
  /** Whether issuance requires a payment step (live mode only). */
  payments_enabled: z.boolean(),
  /** Whether the manual "I have paid" testing bypass is offered. */
  payment_bypass_available: z.boolean(),
  /** Whether live (real-SMS) issuance is available on this issuer. */
  live_mode_available: z.boolean(),
  /**
   * True when the configured phone verifier is the in-process demo
   * (no real SMS is sent). The wallet uses this to display a hint
   * if a user picks "live" against a demo-only deployment.
   */
  demo_phone_provider: z.boolean()
});
var RpScopeSchema = z.enum(["anonymous", "phone"]);
var E164Regex = /^\+[1-9]\d{6,14}$/;
var NonceRegex = /^[0-9a-f]{32}$/;
var HttpsOriginRegex = /^https:\/\/[^\s/?#]+$/;
var RpVerifyRequestSchema = z.object({
  v: z.literal(WALLET_SDK_CONTRACT_VERSION),
  request_id: z.string().regex(NonceRegex),
  rp_origin: z.string().regex(HttpsOriginRegex, "rp_origin must be https origin"),
  rp_name: z.string().min(1).max(80),
  nonce: z.string().regex(NonceRegex),
  iat: z.number().int(),
  expires_at: z.number().int(),
  scope: RpScopeSchema,
  candidate_phone_e164: z.string().regex(E164Regex).nullable(),
  return_url: z.string().url().nullable()
}).refine((r) => r.expires_at - r.iat <= 300, {
  message: "expires_at - iat MUST be \u2264 300 seconds",
  path: ["expires_at"]
}).refine(
  (r) => r.scope === "phone" ? r.candidate_phone_e164 !== null : r.candidate_phone_e164 === null,
  { message: "candidate_phone_e164 presence MUST match scope", path: ["candidate_phone_e164"] }
);
var RpVerifyResponsePayloadSchema = z.object({
  v: z.literal(WALLET_SDK_CONTRACT_VERSION),
  request_id: z.string().regex(NonceRegex),
  rp_origin: z.string().regex(HttpsOriginRegex),
  nonce: z.string().regex(NonceRegex),
  attestation_jti: z.string().min(1),
  proxy_number: z.string().min(1),
  iat: z.number().int(),
  scope: RpScopeSchema,
  candidate_phone_match: z.boolean().nullable()
}).refine(
  (p) => p.scope === "phone" ? typeof p.candidate_phone_match === "boolean" : p.candidate_phone_match === null,
  { message: "candidate_phone_match shape MUST match scope", path: ["candidate_phone_match"] }
);
z.object({
  v: z.literal(WALLET_SDK_CONTRACT_VERSION),
  request_id: z.string().regex(NonceRegex),
  attestation: z.string().min(1),
  issuer: z.string().min(1),
  signed_response: z.object({
    payload: RpVerifyResponsePayloadSchema,
    signature: z.string().regex(/^sig:[A-Za-z0-9_-]+$/)
  })
});
z.object({
  v: z.literal(WALLET_SDK_CONTRACT_VERSION),
  request_id: z.string().regex(NonceRegex),
  error: z.string()
});
function decodeRpVerifyRequest(encoded) {
  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(b64UrlToBytes(encoded)));
  } catch {
    throw new ProtocolError("invalid_response_format", "req is not valid b64url JSON");
  }
  const parsed = RpVerifyRequestSchema.safeParse(json);
  if (!parsed.success) {
    throw new ProtocolError("invalid_response_format", parsed.error.message);
  }
  return parsed.data;
}
function validateRpVerifyRequest(request, options = {}) {
  const skew = options.clockSkewSec ?? 60;
  const now = (options.now ?? (() => Math.floor(Date.now() / 1e3)))();
  if (request.iat > now + skew) {
    throw new ProtocolError("response_from_future", "request iat is too far in the future");
  }
  if (now > request.expires_at) {
    throw new ProtocolError("request_expired", "request expired before consent");
  }
}

// src/index.ts
function parseAndValidateRequest(ctx) {
  if (!ctx.rawReq) {
    return { ok: false, code: "missing_req", message: "Missing required `req` query parameter." };
  }
  let request;
  try {
    request = decodeRpVerifyRequest(ctx.rawReq);
  } catch (e) {
    return {
      ok: false,
      code: "decode_failed",
      message: e instanceof ProtocolError ? `${e.code}: ${e.message}` : e.message
    };
  }
  try {
    validateRpVerifyRequest(request, { now: ctx.now });
  } catch (e) {
    if (e instanceof ProtocolError) {
      const code = e.code === "request_expired" ? "request_expired" : e.code === "response_from_future" ? "response_from_future" : "decode_failed";
      return { ok: false, code, message: e.message };
    }
    return { ok: false, code: "decode_failed", message: e.message };
  }
  const transport = request.return_url ? "redirect" : "popup";
  if (transport === "redirect") {
    let returnOrigin;
    try {
      returnOrigin = new URL(request.return_url).origin;
    } catch {
      return {
        ok: false,
        code: "return_url_origin_mismatch",
        message: "return_url is not a valid URL"
      };
    }
    if (returnOrigin !== request.rp_origin) {
      return {
        ok: false,
        code: "return_url_origin_mismatch",
        message: `return_url origin (${returnOrigin}) does not match rp_origin (${request.rp_origin})`
      };
    }
  }
  if (transport === "popup" && !ctx.hasOpener) {
    return {
      ok: false,
      code: "popup_missing_opener",
      message: "This page must be opened in a popup by a Relying Party, or the request must include a return_url for redirect delivery."
    };
  }
  let referrerOrigin = null;
  if (ctx.referrer) {
    try {
      referrerOrigin = new URL(ctx.referrer).origin;
    } catch {
      referrerOrigin = null;
    }
  }
  if (referrerOrigin && referrerOrigin !== request.rp_origin) {
    return {
      ok: false,
      code: "referrer_origin_mismatch",
      message: `Referring origin (${referrerOrigin}) does not match rp_origin (${request.rp_origin})`
    };
  }
  if (transport === "popup" && !referrerOrigin) {
    return {
      ok: false,
      code: "popup_missing_referrer",
      message: "Cannot verify the requesting site's origin (no referrer was sent). The site must use a referrer policy that exposes its origin, or use the redirect transport with a return_url."
    };
  }
  return { ok: true, request, transport };
}
async function assembleSignedResponse(params) {
  const att = parseAttestation(params.attestationJwt);
  if (att.claims.user_pubkey !== params.holderPublicKeyB64Url) {
    throw new ProtocolError(
      "signing_failed",
      "holder key does not match attestation user_pubkey"
    );
  }
  let candidateMatch;
  if (params.request.scope === "phone") {
    if (!params.request.candidate_phone_e164) {
      throw new ProtocolError(
        "invalid_response_format",
        "phone scope without candidate"
      );
    }
    candidateMatch = phoneHash(params.request.candidate_phone_e164) === att.claims.phone_hash;
  } else {
    candidateMatch = null;
  }
  const now = (params.now ?? (() => Math.floor(Date.now() / 1e3)))();
  const payload = RpVerifyResponsePayloadSchema.parse({
    v: WALLET_SDK_CONTRACT_VERSION,
    request_id: params.request.request_id,
    rp_origin: params.request.rp_origin,
    nonce: params.request.nonce,
    attestation_jti: att.claims.jti,
    proxy_number: att.claims.sub,
    iat: now,
    scope: params.request.scope,
    candidate_phone_match: candidateMatch
  });
  const sig = await params.signer(new TextEncoder().encode(canonicalJson(payload)));
  return {
    v: WALLET_SDK_CONTRACT_VERSION,
    request_id: params.request.request_id,
    attestation: params.attestationJwt,
    issuer: att.claims.iss,
    signed_response: {
      payload,
      signature: `sig:${bytesToB64Url(sig)}`
    }
  };
}
function buildErrorResponse(request, error) {
  return {
    v: WALLET_SDK_CONTRACT_VERSION,
    request_id: request.request_id,
    error
  };
}
function deliverPopupResponse(params) {
  if (!params.opener) {
    throw new Error("deliverPopupResponse: opener is null");
  }
  params.opener.postMessage(
    { type: "numkeys/verify-response", response: params.response },
    params.request.rp_origin
  );
  if (params.closeSelf) {
    setTimeout(params.closeSelf, params.closeDelayMs ?? 50);
  }
}
function buildRedirectUrl(args) {
  if (!args.request.return_url) {
    throw new Error("buildRedirectUrl: request has no return_url");
  }
  let returnOrigin;
  try {
    returnOrigin = new URL(args.request.return_url).origin;
  } catch {
    throw new Error("buildRedirectUrl: return_url is not a valid URL");
  }
  if (returnOrigin !== args.request.rp_origin) {
    throw new Error(
      `buildRedirectUrl: return_url origin (${returnOrigin}) does not match rp_origin (${args.request.rp_origin})`
    );
  }
  const encoded = bytesToB64Url(
    new TextEncoder().encode(canonicalJson(args.response))
  );
  const url = new URL(args.request.return_url);
  url.hash = `numkeys_response=${encoded}`;
  return url.toString();
}

export { NUMKEYS_PROTOCOL_VERSION, ProtocolError, WALLET_SDK_CONTRACT_VERSION, assembleSignedResponse, buildErrorResponse, buildRedirectUrl, bytesToB64Url, canonicalJson, decodeRpVerifyRequest, deliverPopupResponse, parseAndValidateRequest, parseAttestation, phoneHash, validateRpVerifyRequest };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map