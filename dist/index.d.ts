import { z } from 'zod';

declare const NUMKEYS_PROTOCOL_VERSION = "1.2";
/**
 * Identifies the wire contract between an embedding application (RP or
 * first-party site) and the wallet PWA. v2 adds the third-party RP
 * verification flow defined in SPEC.md §9. v1 (challenge/response with
 * `service_id` + `callback_url`) is deprecated but still parseable.
 */
declare const WALLET_SDK_CONTRACT_VERSION = "wallet-sdk/v2";
declare function bytesToB64Url(bytes: Uint8Array): string;
/** Returns "sha256:<hex>" of normalized phone digits. */
declare function phoneHash(e164: string): string;
declare const AttestationClaimsSchema: z.ZodObject<{
    iss: z.ZodString;
    sub: z.ZodString;
    iat: z.ZodNumber;
    jti: z.ZodString;
    phone_hash: z.ZodString;
    user_pubkey: z.ZodString;
    binding_proof: z.ZodString;
    nonce: z.ZodString;
    mode: z.ZodOptional<z.ZodEnum<["demo", "live"]>>;
}, "strip", z.ZodTypeAny, {
    nonce: string;
    iat: number;
    iss: string;
    sub: string;
    jti: string;
    phone_hash: string;
    user_pubkey: string;
    binding_proof: string;
    mode?: "demo" | "live" | undefined;
}, {
    nonce: string;
    iat: number;
    iss: string;
    sub: string;
    jti: string;
    phone_hash: string;
    user_pubkey: string;
    binding_proof: string;
    mode?: "demo" | "live" | undefined;
}>;
type AttestationClaims = z.infer<typeof AttestationClaimsSchema>;
interface ParsedAttestation {
    raw: string;
    header: {
        alg: string;
        typ?: string;
    };
    claims: AttestationClaims;
    signature: Uint8Array;
    signingInput: Uint8Array;
}
declare function parseAttestation(jwt: string): ParsedAttestation;
/**
 * Deterministic JSON canonicalizer: keys sorted lexicographically, no whitespace.
 * Used for signing challenge responses.
 */
declare function canonicalJson(value: unknown): string;
type ProtocolErrorCode = "invalid_attestation_format" | "invalid_attestation_signature" | "invalid_binding_proof" | "issuer_key_discovery_failed" | "challenge_parse_failed" | "challenge_validation_failed" | "signing_failed" | "verification_failed" | "version_mismatch" | "request_expired" | "invalid_response_format" | "request_id_mismatch" | "origin_mismatch" | "nonce_mismatch" | "nonce_replay" | "response_expired" | "response_from_future" | "invalid_holder_signature" | "jti_mismatch" | "proxy_number_mismatch" | "scope_mismatch" | "phone_match_lie" | "phone_does_not_match" | "attestation_expired" | "issuer_not_allowed" | "user_declined";
declare class ProtocolError extends Error {
    code: ProtocolErrorCode;
    constructor(code: ProtocolErrorCode, message: string);
}
declare const RpScopeSchema: z.ZodEnum<["anonymous", "phone"]>;
type RpScope = z.infer<typeof RpScopeSchema>;
/** SPEC.md §9.3 — VerifyRequest wire schema (RP → Wallet). */
declare const RpVerifyRequestSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    v: z.ZodLiteral<"wallet-sdk/v2">;
    request_id: z.ZodString;
    rp_origin: z.ZodString;
    rp_name: z.ZodString;
    nonce: z.ZodString;
    iat: z.ZodNumber;
    expires_at: z.ZodNumber;
    scope: z.ZodEnum<["anonymous", "phone"]>;
    candidate_phone_e164: z.ZodNullable<z.ZodString>;
    return_url: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    rp_name: string;
    nonce: string;
    iat: number;
    expires_at: number;
    scope: "anonymous" | "phone";
    candidate_phone_e164: string | null;
    return_url: string | null;
}, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    rp_name: string;
    nonce: string;
    iat: number;
    expires_at: number;
    scope: "anonymous" | "phone";
    candidate_phone_e164: string | null;
    return_url: string | null;
}>, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    rp_name: string;
    nonce: string;
    iat: number;
    expires_at: number;
    scope: "anonymous" | "phone";
    candidate_phone_e164: string | null;
    return_url: string | null;
}, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    rp_name: string;
    nonce: string;
    iat: number;
    expires_at: number;
    scope: "anonymous" | "phone";
    candidate_phone_e164: string | null;
    return_url: string | null;
}>, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    rp_name: string;
    nonce: string;
    iat: number;
    expires_at: number;
    scope: "anonymous" | "phone";
    candidate_phone_e164: string | null;
    return_url: string | null;
}, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    rp_name: string;
    nonce: string;
    iat: number;
    expires_at: number;
    scope: "anonymous" | "phone";
    candidate_phone_e164: string | null;
    return_url: string | null;
}>;
type RpVerifyRequest = z.infer<typeof RpVerifyRequestSchema>;
/** SPEC.md §9.4 — payload signed by the holder. */
declare const RpVerifyResponsePayloadSchema: z.ZodEffects<z.ZodObject<{
    v: z.ZodLiteral<"wallet-sdk/v2">;
    request_id: z.ZodString;
    rp_origin: z.ZodString;
    nonce: z.ZodString;
    attestation_jti: z.ZodString;
    proxy_number: z.ZodString;
    iat: z.ZodNumber;
    scope: z.ZodEnum<["anonymous", "phone"]>;
    candidate_phone_match: z.ZodNullable<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    nonce: string;
    iat: number;
    scope: "anonymous" | "phone";
    attestation_jti: string;
    proxy_number: string;
    candidate_phone_match: boolean | null;
}, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    nonce: string;
    iat: number;
    scope: "anonymous" | "phone";
    attestation_jti: string;
    proxy_number: string;
    candidate_phone_match: boolean | null;
}>, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    nonce: string;
    iat: number;
    scope: "anonymous" | "phone";
    attestation_jti: string;
    proxy_number: string;
    candidate_phone_match: boolean | null;
}, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    nonce: string;
    iat: number;
    scope: "anonymous" | "phone";
    attestation_jti: string;
    proxy_number: string;
    candidate_phone_match: boolean | null;
}>;
type RpVerifyResponsePayload = z.infer<typeof RpVerifyResponsePayloadSchema>;
/** SPEC.md §9.4 — successful VerifyResponse wire schema (Wallet → RP). */
declare const RpVerifyResponseSchema: z.ZodObject<{
    v: z.ZodLiteral<"wallet-sdk/v2">;
    request_id: z.ZodString;
    attestation: z.ZodString;
    issuer: z.ZodString;
    signed_response: z.ZodObject<{
        payload: z.ZodEffects<z.ZodObject<{
            v: z.ZodLiteral<"wallet-sdk/v2">;
            request_id: z.ZodString;
            rp_origin: z.ZodString;
            nonce: z.ZodString;
            attestation_jti: z.ZodString;
            proxy_number: z.ZodString;
            iat: z.ZodNumber;
            scope: z.ZodEnum<["anonymous", "phone"]>;
            candidate_phone_match: z.ZodNullable<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            iat: number;
            scope: "anonymous" | "phone";
            attestation_jti: string;
            proxy_number: string;
            candidate_phone_match: boolean | null;
        }, {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            iat: number;
            scope: "anonymous" | "phone";
            attestation_jti: string;
            proxy_number: string;
            candidate_phone_match: boolean | null;
        }>, {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            iat: number;
            scope: "anonymous" | "phone";
            attestation_jti: string;
            proxy_number: string;
            candidate_phone_match: boolean | null;
        }, {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            iat: number;
            scope: "anonymous" | "phone";
            attestation_jti: string;
            proxy_number: string;
            candidate_phone_match: boolean | null;
        }>;
        signature: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        payload: {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            iat: number;
            scope: "anonymous" | "phone";
            attestation_jti: string;
            proxy_number: string;
            candidate_phone_match: boolean | null;
        };
        signature: string;
    }, {
        payload: {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            iat: number;
            scope: "anonymous" | "phone";
            attestation_jti: string;
            proxy_number: string;
            candidate_phone_match: boolean | null;
        };
        signature: string;
    }>;
}, "strip", z.ZodTypeAny, {
    v: "wallet-sdk/v2";
    request_id: string;
    attestation: string;
    issuer: string;
    signed_response: {
        payload: {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            iat: number;
            scope: "anonymous" | "phone";
            attestation_jti: string;
            proxy_number: string;
            candidate_phone_match: boolean | null;
        };
        signature: string;
    };
}, {
    v: "wallet-sdk/v2";
    request_id: string;
    attestation: string;
    issuer: string;
    signed_response: {
        payload: {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            iat: number;
            scope: "anonymous" | "phone";
            attestation_jti: string;
            proxy_number: string;
            candidate_phone_match: boolean | null;
        };
        signature: string;
    };
}>;
type RpVerifyResponse = z.infer<typeof RpVerifyResponseSchema>;
/** SPEC.md §9.4 — declined / error response. */
declare const RpVerifyErrorResponseSchema: z.ZodObject<{
    v: z.ZodLiteral<"wallet-sdk/v2">;
    request_id: z.ZodString;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    v: "wallet-sdk/v2";
    request_id: string;
    error: string;
}, {
    v: "wallet-sdk/v2";
    request_id: string;
    error: string;
}>;
type RpVerifyErrorResponse = z.infer<typeof RpVerifyErrorResponseSchema>;
/**
 * Decode the popup `?req=` query parameter. Wallet-side entry point per
 * SPEC.md §9.9.1 step 1. Throws ProtocolError("invalid_response_format")
 * if the payload is not valid b64url canonical JSON of the schema.
 */
declare function decodeRpVerifyRequest(encoded: string): RpVerifyRequest;
interface ValidateRpRequestOptions {
    /** Tolerance in seconds for `iat` in the future (default 60). */
    clockSkewSec?: number;
    now?: () => number;
}
/**
 * Wallet-side request validation per SPEC.md §9.9.1. MUST run before the
 * consent prompt is shown. Throws on any violation.
 */
declare function validateRpVerifyRequest(request: RpVerifyRequest, options?: ValidateRpRequestOptions): void;

/**
 * @numkeys/wallet-sdk — Wallet-side SDK for Numkeys Protocol v1.2.
 *
 * The wallet-side flow has three logical phases:
 *
 *   1. Parse + validate the inbound `?req=<encoded>` request and the
 *      browser context it arrived in (referrer, opener, return_url).
 *      → `parseAndValidateRequest`
 *
 *   2. Display a consent screen with the rp_origin and (optional)
 *      candidate phone, collect Allow/Decline. (UI is wallet-specific.)
 *
 *   3. On Allow, assemble the signed VerifyResponse from the user's
 *      attestation and a signer callback (the SDK never touches raw
 *      key material), then deliver it to the RP via popup or redirect.
 *      → `assembleSignedResponse`, `deliverResponse`
 *
 * The SDK is deliberately UI-agnostic so it can be reused by browser
 * wallets, native mobile wallets, or browser-extension wallets. All the
 * functions are pure (or take an explicit transport object) so they are
 * straightforward to unit-test.
 */

type Transport = "popup" | "redirect";
interface BrowserContext {
    /** The raw `?req=` query value. */
    rawReq: string | null;
    /** `document.referrer`. May be empty if the RP set Referrer-Policy: no-referrer. */
    referrer: string;
    /** `window.opener != null`. */
    hasOpener: boolean;
    /** Optional clock override for tests. */
    now?: () => number;
}
type ParseResult = {
    ok: true;
    request: RpVerifyRequest;
    transport: Transport;
} | {
    ok: false;
    code: "missing_req" | "decode_failed" | "request_expired" | "response_from_future" | "return_url_origin_mismatch" | "referrer_origin_mismatch" | "popup_missing_referrer" | "popup_missing_opener";
    message: string;
};
/**
 * Pure parse + cross-binding validation per SPEC §9.5 and §9.9.1. This
 * is the single source of truth for "should we even prompt the user".
 *
 * On success, returns the validated request and the inferred transport.
 * On failure, returns a discriminated error suitable for either an
 * inline UI message or a structured error response back to the RP.
 */
declare function parseAndValidateRequest(ctx: BrowserContext): ParseResult;
/**
 * Signer callback. Implementations sign canonical bytes with the holder's
 * Ed25519 private key WITHOUT exposing the key to this SDK. The SDK
 * verifies the holder pubkey matches the attestation's `user_pubkey`
 * before invoking the signer, so wallet bugs (wrong account selected)
 * surface as a synchronous error rather than an unverifiable response.
 */
type WalletSigner = (canonicalBytes: Uint8Array) => Promise<Uint8Array>;
interface AssembleSignedResponseParams {
    request: RpVerifyRequest;
    /** The full attestation JWT to present. */
    attestationJwt: string;
    /** Holder's Ed25519 public key (b64url) — must match attestation's user_pubkey. */
    holderPublicKeyB64Url: string;
    /** Signs canonical_json(payload) bytes with the holder key. */
    signer: WalletSigner;
    now?: () => number;
}
/**
 * Build the signed VerifyResponse (SPEC §9.4 + §9.6) without ever
 * touching the holder seed. The signer callback receives canonical
 * bytes and returns the raw 64-byte Ed25519 signature; the SDK assembles
 * the wire format around it.
 */
declare function assembleSignedResponse(params: AssembleSignedResponseParams): Promise<RpVerifyResponse>;
/** Build a structured user-declined / error response per SPEC §9.4. */
declare function buildErrorResponse(request: RpVerifyRequest, error: string): RpVerifyErrorResponse;
interface DeliverPopupParams {
    request: RpVerifyRequest;
    response: RpVerifyResponse | RpVerifyErrorResponse;
    /** Usually `window.opener`. */
    opener: {
        postMessage: (data: unknown, targetOrigin: string) => void;
    } | null;
    /** Optional close hook (typically `window.close`). */
    closeSelf?: () => void;
    /** Delay in ms before closing self. Default 50. */
    closeDelayMs?: number;
}
/**
 * Deliver a response via popup transport (SPEC §9.5.1). The SDK enforces
 * `targetOrigin = request.rp_origin` so a malicious cross-origin parent
 * cannot intercept the response.
 */
declare function deliverPopupResponse(params: DeliverPopupParams): void;
/**
 * Build the redirect URL for redirect transport (SPEC §9.5.2). Caller is
 * responsible for the actual top-level navigation (typically
 * `window.location.assign(url)`).
 */
declare function buildRedirectUrl(args: {
    request: RpVerifyRequest;
    response: RpVerifyResponse | RpVerifyErrorResponse;
}): string;

export { type AssembleSignedResponseParams, type BrowserContext, type DeliverPopupParams, NUMKEYS_PROTOCOL_VERSION, type ParseResult, ProtocolError, type RpScope, type RpVerifyErrorResponse, type RpVerifyRequest, type RpVerifyResponse, type RpVerifyResponsePayload, type Transport, WALLET_SDK_CONTRACT_VERSION, type WalletSigner, assembleSignedResponse, buildErrorResponse, buildRedirectUrl, bytesToB64Url, canonicalJson, decodeRpVerifyRequest, deliverPopupResponse, parseAndValidateRequest, parseAttestation, phoneHash, validateRpVerifyRequest };
