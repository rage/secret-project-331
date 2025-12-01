import { expect, test } from "@playwright/test"

import {
  AUTHORIZE,
  BASE,
  JWKS_URI,
  REVOKE,
  TOKEN,
  USERINFO,
  WELL_KNOWN,
} from "../../utils/oauth/constants"
// ============================================================================
// OIDC Discovery and JWKS
// ============================================================================
test.describe("OIDC discovery and JWKS", () => {
  test("well-known configuration exposes expected fields and values", async () => {
    const resp = await fetch(WELL_KNOWN, { method: "GET", headers: { Accept: "application/json" } })
    expect(resp.status).toBe(200)
    const cfg = await resp.json()

    // Required endpoints/fields
    expect(cfg.issuer).toBe(`${BASE}/api/v0/main-frontend/oauth`)
    expect(cfg.authorization_endpoint).toBe(AUTHORIZE)
    expect(cfg.token_endpoint).toBe(TOKEN)
    expect(cfg.userinfo_endpoint).toBe(USERINFO)
    expect(cfg.revocation_endpoint).toBe(REVOKE)
    expect(cfg.jwks_uri).toBe(JWKS_URI)

    // Capabilities
    expect(cfg.response_types_supported).toContain("code")
    expect(cfg.subject_types_supported).toContain("public")
    expect(cfg.id_token_signing_alg_values_supported).toContain("RS256")
    // You advertise DPoP algs too
    expect(cfg.dpop_signing_alg_values_supported).toStrictEqual(
      expect.arrayContaining(["ES256", "RS256"]),
    )
    expect(cfg.token_endpoint_auth_methods_supported).toStrictEqual(
      expect.arrayContaining(["client_secret_post"]),
    )
  })

  const b64urlRe = /^[A-Za-z0-9_-]+$/
  const isB64Url = (s: unknown) => typeof s === "string" && s.length > 0 && b64urlRe.test(s)

  test("jwks returns at least one RS256 signing key with valid n/e/kid", async () => {
    const resp = await fetch(JWKS_URI, { method: "GET", headers: { Accept: "application/json" } })
    expect(resp.status).toBe(200)
    const jwks = await resp.json()

    expect(Array.isArray(jwks.keys)).toBe(true)
    expect(jwks.keys.length).toBeGreaterThanOrEqual(1)

    const k = jwks.keys[0]
    // Shape & values
    expect(k.kty).toBe("RSA")
    expect(k.use || "sig").toBe("sig")
    expect(k.alg).toBe("RS256")
    expect(typeof k.kid).toBe("string")
    expect(k.kid.length).toBeGreaterThan(0)

    // Base64url parameters
    expect(isB64Url(k.n)).toBe(true)
    expect(isB64Url(k.e)).toBe(true)

    // Optionally: fetch the well-known and ensure its jwks_uri matches what we hit
    const cfg = await (await fetch(WELL_KNOWN)).json()
    expect(cfg.jwks_uri).toBe(JWKS_URI)
  })
})
