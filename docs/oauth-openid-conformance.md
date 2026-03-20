# OAuth 2.0 and OpenID Connect in headless-lms

This note describes how authorization is implemented in **headless-lms** (the Rust backend) and where it diverges from expectations raised by **OpenID Connect** specs and the **[OpenID conformance / certification tooling](https://openid.net/certification/)** (often called “OIDC Conformance” tests).

It is **not** a statement of formal certification status; it is engineering documentation to steer future hardening and test runs.

## Where the code lives

| Area                                              | Location                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| HTTP controllers (endpoints)                      | `services/headless-lms/server/src/controllers/main_frontend/oauth/` |
| Core logic (validation, tokens, JWKS helpers)     | `services/headless-lms/server/src/domain/oauth/`                    |
| Persistence (clients, codes, tokens, DPoP proofs) | `services/headless-lms/models/src/oauth_*.rs`                       |

Routes are mounted under the main-frontend API prefix, for example:

- Issuer (conceptually): `{base_url}/api/v0/main-frontend/oauth`
- Discovery: `GET …/oauth/.well-known/openid-configuration`
- JWKS: `GET …/oauth/jwks.json`
- Authorization: `GET` / `POST` …/oauth/authorize`
- Token: `POST` …/oauth/token
- UserInfo: `GET` / `POST` …/oauth/userinfo
- Revocation: `POST …/oauth/revoke`
- Introspection: `POST …/oauth/introspect`
- Consent UI hand-off: `…/oauth/consent` (application-specific)

## What is implemented (high level)

- **OAuth 2.0 authorization code flow** with `response_type=code` only (no implicit or hybrid flows).
- **PKCE** with `S256` (`code_challenge_methods_supported` in discovery matches server behavior; public clients and `require_pkce` enforce this).
- **Optional DPoP** (RFC 9449) at the token and userinfo endpoints: clients that are not allowed to use bearer tokens must send `DPoP` proofs; issued access tokens may be typed `DPoP` instead of `Bearer`.
- **Refresh token grant** with **refresh token rotation** (old refresh token invalidated when a new pair is issued).
- **OIDC-style ID tokens**: JWT signed with **RS256**, `kid` on the JWS header, public key exposed via **JWKS**.
- **OIDC Discovery document** (JSON metadata) and **UserInfo** endpoint with scope-gated claims (`profile`, `email`).
- **Client model** supports public vs confidential clients, `client_secret_post` vs `none`, redirect URI allow lists, grant allow lists, and related flags (see `oauth_client.rs`).

Consent is handled via redirects into the LMS login/consent UX rather than as a bare protocol endpoint; that is intentional for this product but differs from “pure” AS-only test harnesses.

## Conformance suite: runs, exports, and recording results

Full test outputs (HTML, traces, large folders) are **temporary** and should **not** be committed. Use the repo-local convention instead:

| What                                                    | Where                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| How to run the tool, copy exports, pre-flight checklist | [docs/conformance/README.md](./conformance/README.md)                              |
| Large export folders from the desktop suite             | `docs/conformance/exports/` or repo root `oidc-comformance/` (**both gitignored**) |
| Private scratch notes                                   | `docs/conformance/RESULTS.local.md` (**gitignored**)                               |
| Durable summary for the team                            | This file, section **Conformance run log** (below)                                 |

After each run, paste a **short** summary into **Conformance run log**: plan id (URL query e.g. `plan=…`), profile name (`client_secret_post` + `code` + static client, etc.), date, and failed test identifiers with a one-line diagnosis. That keeps history in git without an “OIDC expert” tree or personal `Downloads` paths.

### Conformance run log

Source for the row below: exported plan in repo root **`oidc-comformance/`** (`index.html`, suite **5.1.36**), exported **2026-03-20 UTC**; plan id **auRS2w5Pv7N6c**; variant **client_auth_type=client_secret_post**, **response_type=code**, **client_registration=static_client**, **response_mode=default**.

| Date       | Plan / profile                                                    | Outcome summary                                                                |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 2026-03-20 | Plan `auRS2w5Pv7N6c`, `client_secret_post` + code + static client | **4 FAILED**, **7 WARNING**, **4 SKIPPED**, **4 REVIEW**, remainder **PASSED** |

#### FAILED (with failure summary from export)

| Test                         | Id                | Notes                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **oidcc-prompt-login**       | `5icDmfa8i9uAZnv` | Test expected authorization to succeed after re-authentication; OP returned an authorization error. Export shows `error=login_required`, `error_description=prompt=login is not supported` — current server rejects `prompt=login` instead of performing a fresh login per OIDC. Status **INTERRUPTED** in plan table. |
| **oidcc-max-age-1**          | `qDhEu3CWXNsr0lz` | **`auth_time` missing from ID token** when `max_age` is used (required by OIDC for this scenario). Status **INTERRUPTED**.                                                                                                                                                                                             |
| **oidcc-max-age-10000**      | `1OeA2rSQfAup3B5` | Same root cause: **`auth_time` missing from ID token** when `max_age` is used. Status **INTERRUPTED**.                                                                                                                                                                                                                 |
| **oidcc-server-rotate-keys** | `NKRWKn5RTSZcXt9` | JWKS did not gain a new signing key after instructed rotation: **“No new keys with 'use':'sig' (or no 'use') found”**. Matches “single static key / no rotation” behavior in code.                                                                                                                                     |

#### WARNING (non-pass; needs review in HTML logs)

| Test                                          | Id                |
| --------------------------------------------- | ----------------- |
| oidcc-claims-essential                        | `Or9bos4MuTFYis0` |
| oidcc-scope-email                             | `zrkVVwpQGbrwYE1` |
| oidcc-scope-profile                           | `xwVo9v5F12JFZux` |
| oidcc-ensure-other-scope-order-succeeds       | `8AhJXqx1wJfojGl` |
| oidcc-userinfo-post-body                      | `dxtlqqKe9TKjfZ7` |
| oidcc-ensure-request-with-acr-values-succeeds | `BTg6zFuJgP95aWn` |
| oidcc-codereuse-30seconds                     | `uyoTiie2fskFKSm` |

#### SKIPPED

oidcc-scope-address (`uMnuDd7ym4YBGYe`), oidcc-scope-all (`r6lmgWAxWiPyhjM`), oidcc-scope-phone (`IUeh0mnK5DT10gI`), oidcc-unsigned-request-object-supported-correctly-or-rejected-as-unsupported (`Cfocc2Q6Vd9SQJt`).

#### REVIEW (manual / inconclusive in tool)

oidcc-ensure-registered-redirect-uri (`9BPJjJpD8bUKA41`), oidcc-ensure-request-object-with-redirect-uri (`4wikrVODIPjWzDi`), oidcc-redirect-uri-query-added (`U4k1ZrAdEpXv57p`), oidcc-response-type-missing (`vrkdUPD8jjYv2NN`).

---

<!-- Add new rows for future runs:

| Date | Plan / profile | Outcome summary |
|------|----------------|-----------------|

-->

## OpenID conformance context

The OpenID Foundation publishes **automated conformance tests** for OpenID Connect and related OAuth profiles. Those suites assume a particular combination of:

- Discovery metadata accuracy (what you advertise vs what you implement),
- Mandatory and optional claims and parameters,
- Error codes and redirect-vs-JSON error behavior,
- Token endpoint client authentication methods,
- Flow variants (code, hybrid, form_post, etc.).

**Formal certification** is separate from developer test runs. The gaps below combine **code review** with typical OpenID suite expectations. After you record outcomes in **Conformance run log**, treat that table as the source of truth for **observed** failures; keep this section aligned when fixes land.

## Gaps and mismatches (likely conformance friction)

The following items are the main places an OpenID-style test plan or certified profile would complain, or where metadata and runtime behavior disagree.

### Discovery metadata vs runtime

- **`claims_supported` overstates delivery**: Discovery lists claims such as `auth_time` and `email_verified`, but **ID tokens** only carry `sub`, `aud`, `iss`, `iat`, `exp`, and optional `nonce` (`claims.rs`, `oidc.rs`). **UserInfo** returns `sub`, optional name fields, and `email` when scoped—it does **not** emit `email_verified`. Either implementations should add these claims where appropriate, or discovery should be narrowed to avoid implying support.
- **`request_object_signing_alg_values_supported`** includes `RS256` while **`request_parameter_supported` is `false`** and the authorize handler rejects `request` via `request_not_supported`. That pairing can confuse strict clients; algorithms for unsupported features are usually omitted or clearly marked optional.
- **`introspection_endpoint` is missing** from the discovery document even though **`/introspect`** exists. RFC 8414-style metadata often expects revocation and introspection URIs to be advertised when implemented.

### ID token contents (OIDC Core)

- **`auth_time` is absent** even though authentication happens through the LMS session; OIDC requires `auth_time` in some cases (e.g. when `max_age` is used). **`max_age`** (and related auth timing parameters) are not surfaced on `/authorize`.
- **`at_hash` / `c_hash`** are not issued. For pure code flow, some OIDC tests or profiles still expect or recommend binding hashes depending on response type and deployment profile.
- **Refresh token grant**: After `refresh_token` exchange, the implementation sets `issue_id_token: false` in token processing, so **no new ID token** is returned on refresh even if `openid` remains in scope. OIDC allows issuance here in some configurations; tests that expect a refreshed ID token would fail.

### Authorization endpoint parameters

- **`prompt=login` and `prompt=select_account`** are explicitly rejected (error returned to the client). OIDC defines these values; a conformance plan that exercises them will fail unless the server implements or gracefully maps them.
- **`prompt` handling is partial**: `none`, `consent`, and unsupported combinations are handled, but not the full OIDC prompt matrix.
- **JAR / PAR**: `request` parameter is rejected (`request_not_supported`). **Pushed Authorization Requests (PAR)** are not implemented.
- **Error code typo**: For unsupported `prompt` values, errors use the string **`inalid_request`** instead of **`invalid_request`** (see `authorize.rs`). That is a spec-level bug relative to OAuth/OIDC error vocabulary.

### Token endpoint authentication

- Discovery advertises **`token_endpoint_auth_methods_supported`: `none`, `client_secret_post`** only. The client model (`TokenEndpointAuthMethod`) likewise **does not include `client_secret_basic`**. Certification or clients that only support HTTP Basic authentication for confidential clients would need that method added (or must use POST).

### UserInfo endpoint

- **Signed / encrypted UserInfo responses** are not supported (`userinfo_signing_alg_values_supported` is an empty array in discovery—consistent with plain JSON responses).
- **Claim coverage** for `email` scope stops at `email`; **`email_verified` is listed in discovery but not returned**, which is a direct metadata/behavior mismatch.

### Keys and rotation

- **Single static JWKS key**; rotation and `kid` rollover are called out in code comments as **not implemented** (`discovery.rs` / `jwks` handler). OIDC deployments that rotate signing keys need a story for overlapping keys in JWKS and issuer metadata updates.

### Response modes and front-channel logout

- **`response_modes_supported` is `query` only**; `fragment`, `form_post`, etc. are absent (appropriate for code-only flow, but hybrid/form_post suites would not apply).
- **RP-Initiated Logout / Session Management (`end_session_endpoint`, `check_session_iframe`, etc.)** are not advertised in discovery, despite client fields like `post_logout_redirect_uris` existing in the data model—logout is not exposed as a standard OIDC endpoint in metadata.

### Non-standard but intentional product choices

- **Issuer string** includes the API path segment `…/api/v0/main-frontend/oauth`. That is valid if discovery and tokens agree (they do in code), but some integrators expect the issuer at site root; this is a compatibility consideration, not a spec violation by itself.
- **DPoP `token_type` value `DPoP`** and stricter UserInfo auth are good for security but may require **conformance modules** that understand RFC 9449; older OIDC-only suites assume `Bearer` everywhere.

## Suggested next steps for conformance work

1. Run the relevant **[OpenID certification test plan(s)](https://openid.net/certification/connect_op_testing/)** against a staging issuer and record pass/fail IDs (then replace this document’s “inferred” section with factual results).
2. **Align discovery with behavior**: trim `claims_supported` or implement the missing claims; add `introspection_endpoint` if `/introspect` remains public API; fix `request_object_signing_alg_values_supported` vs `request_parameter_supported`.
3. Fix the **`inalid_request`** OAuth error string to **`invalid_request`**.
4. Decide on **refresh-time ID tokens** and **`auth_time` / `max_age`** policy, then implement or document as out of scope.
5. If targeting enterprise clients, evaluate **`client_secret_basic`** and **pairwise `sub`** (`subject_types_supported` currently only `public`).

## References

- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)
- [OAuth 2.0 Authorization Framework (RFC 6749)](https://datatracker.ietf.org/doc/html/rfc6749)
- [OAuth 2.0 Authorization Server Metadata (RFC 8414)](https://www.rfc-editor.org/rfc/rfc8414)
- [DPoP (RFC 9449)](https://www.rfc-editor.org/rfc/rfc9449)
- [OpenID Certification](https://openid.net/certification/)
