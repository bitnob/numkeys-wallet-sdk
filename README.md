# @numkeys/wallet-sdk

The wallet-side SDK for the [Numkeys Protocol](https://github.com/bitnob/numkeys-protocol). If you're building a wallet — browser PWA, mobile app, or browser extension — that needs to respond to verification requests from third-party websites, this is the package.

```sh
pnpm add github:bitnob/numkeys-wallet-sdk#v0.1.0
```

> Always pin to a tag or commit SHA. `main` is mutable.

---

## What this SDK does (and doesn't)

It handles the **protocol-correctness** half of being a wallet:

- Parses the inbound `?req=…` parameter and validates every cross-binding rule (referrer matches `rp_origin`, return URL matches `rp_origin`, request hasn't expired, etc.) **before** you show your consent UI.
- Builds the canonical signed response payload from a chosen attestation.
- Delivers the response via popup `postMessage` or redirect fragment, with the right `targetOrigin` so the response can't be intercepted.
- Provides a structured way to send back user-decline / error responses.

It deliberately does **not**:

- Touch your private key. You provide a `signer` callback; the SDK passes you canonical bytes and gets a 64-byte Ed25519 signature back. This works identically for browser wallets that hold keys behind a passphrase, mobile wallets backed by Keychain/Keystore, and hardware wallets.
- Render any UI. The consent screen, account picker, and error dialogs are yours to design — the SDK gives you the verified inputs and the building blocks.

---

## The wallet flow at a glance

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. RP opens (popup or redirect)  https://yourwallet.com/verify?req=…     │
│                                                                          │
│ 2. parseAndValidateRequest(...)  ← SDK; rejects malformed/cross-origin   │
│       ↓                                                                  │
│ 3. Show consent UI                ← your code                            │
│       ↓ user clicks Allow                                                │
│ 4. assembleSignedResponse(...)   ← SDK; calls your signer callback       │
│       ↓                                                                  │
│ 5. deliverPopupResponse(...)     ← SDK; postMessage to opener            │
│    or                                                                    │
│    location.assign(buildRedirectUrl(...))                                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Quickstart

```ts
import {
  parseAndValidateRequest,
  assembleSignedResponse,
  deliverPopupResponse,
  buildRedirectUrl,
  buildErrorResponse,
} from "@numkeys/wallet-sdk";

// On the /verify page:
const url = new URL(location.href);
const parsed = parseAndValidateRequest({
  rawReq: url.searchParams.get("req"),
  referrer: document.referrer,
  hasOpener: window.opener != null,
});

if (!parsed.ok) {
  // Show the user a friendly error. parsed.code is one of:
  //   missing_req | decode_failed | request_expired | response_from_future
  //   return_url_origin_mismatch | referrer_origin_mismatch
  //   popup_missing_referrer | popup_missing_opener
  showError(parsed.code, parsed.message);
  return;
}

const { request, transport } = parsed;

// Show consent UI. Always show the literal request.rp_origin — never something derived from it.
const userChoice = await showConsentUi({
  rpOrigin: request.rp_origin,
  rpName: request.rp_name,
  scope: request.scope,
  candidatePhone: request.candidate_phone_e164 ?? null,
});

if (userChoice === "decline") {
  const err = buildErrorResponse(request, "user_declined");
  if (transport === "popup") {
    deliverPopupResponse({ request, response: err, opener: window.opener, closeSelf: () => window.close() });
  } else {
    location.assign(buildRedirectUrl({ request, response: err }));
  }
  return;
}

// User clicked Allow. Pick which attestation to present (your wallet's UX).
const attestation = await pickAttestationFor(request);

const response = await assembleSignedResponse({
  request,
  attestationJwt: attestation.jwt,
  holderPublicKeyB64Url: attestation.holderPubkey,
  signer: async (canonicalBytes) => myWallet.signEd25519(canonicalBytes),
});

if (transport === "popup") {
  deliverPopupResponse({ request, response, opener: window.opener, closeSelf: () => window.close() });
} else {
  location.assign(buildRedirectUrl({ request, response }));
}
```

That's the whole integration. Every protocol rule from SPEC §9.5 / §9.9.1 (referrer binding, return-URL binding, opener requirements, request expiry) is enforced inside `parseAndValidateRequest` — **before** you show consent — so a malicious caller can't trick the user into approving a request they couldn't have legitimately sent.

---

## API reference

### `parseAndValidateRequest(ctx) → ParseResult`

Pure function. Validates the request and the browser context it arrived in.

**Input:**

```ts
{
  rawReq: string | null;     // url.searchParams.get("req")
  referrer: string;          // document.referrer
  hasOpener: boolean;        // window.opener != null
  now?: () => number;        // optional clock override (tests)
}
```

**Output:**

```ts
| { ok: true; request: RpVerifyRequest; transport: "popup" | "redirect" }
| { ok: false; code: ParseErrorCode; message: string }
```

The SDK infers `transport` from the request: presence of `return_url` ⇒ `"redirect"`, otherwise `"popup"`. You don't choose — the RP did when they built the request.

**Error codes and what they mean:**

| code | meaning | what to show the user |
|---|---|---|
| `missing_req` | No `?req=` query param. | "This page expects to be opened by a website verifying your identity." |
| `decode_failed` | The `req` parameter is malformed or the request fails schema validation. | "The verification request is invalid. Please try again from the original site." |
| `request_expired` | The request's `iat + ttl` is in the past. | "This verification link expired. Please start over." |
| `response_from_future` | The request's `iat` is too far in the future (clock skew). | Same as above — usually a clock issue. |
| `return_url_origin_mismatch` | The `return_url` host doesn't match `rp_origin`. | Almost always an attack attempt — show a security warning. |
| `referrer_origin_mismatch` | The browser-provided referrer doesn't match `rp_origin`. | Same — probable attack. |
| `popup_missing_referrer` | Popup transport, but the browser didn't send a referrer. | "The site that opened this page hides its identity. We can't safely verify for it." |
| `popup_missing_opener` | Popup transport, but `window.opener` is null. | "Open this page from a verifying site — don't navigate to it directly." |

### `assembleSignedResponse(params) → Promise<RpVerifyResponse>`

Build the signed response. Calls your signer with canonical bytes; assembles the wire format around the resulting signature.

```ts
{
  request: RpVerifyRequest;             // from parseAndValidateRequest
  attestationJwt: string;               // the attestation the user is presenting
  holderPublicKeyB64Url: string;        // holder's Ed25519 pubkey (b64url)
  signer: (canonicalBytes) => Promise<Uint8Array>;  // raw 64-byte ed25519 sig
  now?: () => number;
}
```

Throws `ProtocolError("signing_failed", ...)` if `holderPublicKeyB64Url` doesn't match the attestation's `user_pubkey` — this catches the most common wallet bug (wrong account selected) before producing an unverifiable response.

For `scope: "phone"` requests, the SDK computes `phoneHash(candidate)` and sets `candidate_phone_match: true | false` automatically. If it's `false` you can still deliver — most wallets do, so the RP can show a clear "that's not the verified number" error — but you can also choose to send `buildErrorResponse(request, "phone_mismatch")` instead.

### `deliverPopupResponse(params) → void`

postMessage the response to the opener with `targetOrigin = request.rp_origin` (so the response can't be intercepted by an unrelated parent). Optionally closes the popup after a short delay.

```ts
{
  request: RpVerifyRequest;
  response: RpVerifyResponse | RpVerifyErrorResponse;
  opener: Window | null;        // typically window.opener
  closeSelf?: () => void;       // typically () => window.close()
  closeDelayMs?: number;        // default 50
}
```

Throws if `opener` is null.

### `buildRedirectUrl({ request, response }) → string`

Build the return URL with the response packed into the fragment as `#numkeys_response=<b64url>`. Caller does the actual `location.assign(url)`. Throws if `request.return_url` is missing or its origin doesn't match `rp_origin` (defense-in-depth — `parseAndValidateRequest` catches this earlier, but this also protects callers who construct requests by hand).

### `buildErrorResponse(request, error) → RpVerifyErrorResponse`

A structured decline / error response. Standard `error` codes:

- `user_declined` — user clicked Decline
- `phone_mismatch` — candidate phone doesn't match
- `no_attestation` — user has no usable attestation for the requested scope
- anything else — your custom code; the RP will surface it as a `declined` reason

Deliver the same way as a success response (`deliverPopupResponse` or `buildRedirectUrl`).

### Lower-level exports

If you need direct access:

- `decodeRpVerifyRequest(raw)` — decode without liveness checks
- `validateRpVerifyRequest(req, { now })` — liveness-only check
- `parseAttestation(jwt)` — JWT → typed claims
- `phoneHash(e164)` — the canonical phone-hash function
- `bytesToB64Url`, `canonicalJson` — codec helpers
- `ProtocolError` — base error class with `.code`

---

## Why a signer callback (no raw key)?

Three reasons, in order of importance:

1. **Mobile platforms forbid key extraction.** iOS Keychain and Android Keystore can sign with a key but cannot export it. A `signer` callback is the only API that works across both browser and native wallets.
2. **Smaller attack surface for the SDK.** The SDK has no path that touches your seed phrase or private bytes. A bug in the SDK can't leak material it never sees.
3. **Narrower unlock scopes.** Your wallet probably gates key access behind a passphrase or biometric. The signer pattern lets you prompt for unlock once per signing operation — never holding the key in memory longer than needed.

The SDK validates that `holderPublicKeyB64Url` matches the attestation's `user_pubkey` **synchronously, before** invoking the signer. So the most common wallet bug — the user picked Account A but the wallet handed Account B's key to the signer — fails loudly with a `ProtocolError` instead of producing a response the RP can't verify.

---

## UX guidance for the consent screen

The SDK doesn't render UI, but a few things matter for security:

- **Always display the literal `request.rp_origin`** prominently. Don't paraphrase it, don't strip subdomains, don't show a logo derived from it. The user's mental model has to be "this site is asking" with the actual hostname.
- **Distinguish the two scopes clearly.** `anonymous` reveals only that the user is a verified human. `phone` additionally proves they own a specific phone number — a meaningful step up in disclosure.
- **For `scope: "phone"`,** show the candidate phone the RP supplied and let the user spot mismatches before signing. The SDK will already compute `candidate_phone_match`, but a pre-flight visual check stops accidental approvals.
- **Show the attestation issuer.** Different issuers have different trust roots; the user should know who's vouching.

---

## Tests

The package ships with a 20-case Vitest hostile suite (`pnpm --filter @numkeys/wallet-sdk run test` if you've vendored the source). It covers: missing/garbage requests, expired/future requests, missing referrer in popup mode, mismatched referrer, mismatched return URL, cross-account signing attempts, target-origin leakage on delivery, and redirect-origin tampering. If you fork this SDK, run the suite — it'll catch most regressions.

---

## License

MIT
