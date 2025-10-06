import { BrowserContext, expect, Page, test } from "@playwright/test"
import crypto from "crypto"
import http from "http"
import { exportJWK, generateKeyPair, type JWK, SignJWT } from "jose"

type KeyLike = CryptoKey | import("crypto").KeyObject
// ---------- ENV / CONSTANTS ----------
const BASE = "http://project-331.local"
const AUTHORIZE = `${BASE}/api/v0/main-frontend/oauth/authorize`
const TOKEN = `${BASE}/api/v0/main-frontend/oauth/token`
const USERINFO = `${BASE}/api/v0/main-frontend/oauth/userinfo`
const WELL_KNOWN = `${BASE}/api/v0/main-frontend/oauth/.well-known/openid-configuration`
const JWKS_URI = `${BASE}/api/v0/main-frontend/oauth/jwks.json`

const TEST_CLIENT_ID = "test-client-id"
const TEST_CLIENT_SECRET = "very-secret" // <- hardcoded as requested
const APP_DISPLAY_NAME = "Test Client" // shown on consent <h2> and settings <strong>
const REDIRECT_URI = "http://127.0.0.1:8765/callback" // MUST match the registered redirect for TEST_CLIENT_ID

// Test users
const USER_EMAIL = "student1@example.com"
const USER_PASSWORD = "student1"
const USER_EMAIL_2 = "student2@example.com"
const USER_PASSWORD_2 = "student2"

// Already-logged-in storage state for the same student
const STUDENT_STORAGE_STATE = "src/states/student1@example.com.json"

// ---------- CONSENT PAGE OBJECT ----------
class ConsentPage {
  constructor(
    private page: Page,
    private scopes: string[],
  ) {}
  private esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  private get scopesRegex() {
    return new RegExp(`\\b(${this.scopes.map(this.esc).join("|")})\\b`, "i")
  }
  private get ul() {
    return this.page
      .locator("ul")
      .filter({ has: this.page.locator("li", { hasText: this.scopesRegex }) })
      .first()
  }
  private get container() {
    return this.ul.locator("xpath=ancestor::div[1]")
  }
  private get title() {
    return this.container.locator("h2").first()
  }

  async expectVisible(name: string | RegExp) {
    await expect(this.ul).toBeVisible()
    await expect(this.title).toBeVisible()
    await expect(this.title).toContainText(name)
    for (const s of this.scopes) {
      await expect(
        this.ul.locator("li", { hasText: new RegExp(`\\b${this.esc(s)}\\b`, "i") }).first(),
      ).toBeVisible()
    }
  }

  async approve() {
    await this.ul.locator("xpath=following::button[1]").click()
  }

  async expectNotPresent() {
    await expect(this.title).toHaveCount(0)
  }
}

// ---------- LOCAL REDIRECT RECEIVER (real HTTP server on 127.0.0.1:8765) ----------
let _redirectServer: http.Server | null = null

test.beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    const uri = new URL(REDIRECT_URI)
    _redirectServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end("<!doctype html><title>OAuth Callback</title><h1>Callback OK</h1>")
    })
    _redirectServer.once("error", reject)
    _redirectServer.listen(Number(uri.port || 80), uri.hostname, () => resolve())
  })
})

test.afterAll(async () => {
  if (_redirectServer) {
    await new Promise<void>((resolve) => _redirectServer!.close(() => resolve()))
    _redirectServer = null
  }
})

// ---------- HELPERS ----------
function oauthUrl(scopes: string[]) {
  const state = crypto.randomBytes(9).toString("hex")
  const params = new URLSearchParams({
    response_type: "code",
    client_id: TEST_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: scopes.join(" "),
    state,
  })
  return { url: `${AUTHORIZE}?${params.toString()}`, state, scopes }
}

async function performLogin(page: Page, email: string, password: string) {
  // Scope to the actual login <form> via the submit button id
  const form = page
    .locator("form")
    .filter({ has: page.locator("#login-button") })
    .first()
  await form.locator("input").first().fill(email)
  await form.locator("input").nth(1).fill(password)
  await form.locator("#login-button").click()
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible()
}

/** Assert the browser landed on the callback and the final URL has code & expected state.
 *  Returns the authorization code for token exchange. */
async function assertAndExtractCodeFromCallbackUrl(
  page: Page,
  expectedState: string,
): Promise<string> {
  const expected = new URL(REDIRECT_URI)

  // Wait until we actually reach the callback origin+path
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const expectedBase = `${escapeRe(expected.origin)}${escapeRe(expected.pathname)}`
  await page.waitForURL(new RegExp(`^${expectedBase}(\\?.*)?$`, "i"))

  await page.waitForLoadState("domcontentloaded")
  const final = new URL(page.url())
  expect(final.origin + final.pathname).toBe(expected.origin + expected.pathname)

  const code = final.searchParams.get("code")
  const state = final.searchParams.get("state")
  expect(state).toBe(expectedState)
  expect(code).toBeTruthy()
  return code!
}

/** Revoke a single client row by visible name */
async function revokeClientRow(page: Page, displayName: string) {
  const row = page
    .locator("div", { has: page.locator("strong", { hasText: displayName }) })
    .filter({ has: page.getByRole("button") })
    .first()

  if ((await row.count()) === 0) {
    return false
  }
  const revokeBtn = row.getByRole("button", { name: "REVOKE" })
  await revokeBtn.click()
  await expect(row).toHaveCount(0)
  return true
}

async function openAuthorizedApps(page: Page) {
  await page.goto(`${BASE}/user-settings`)
  const authorizedHeading = page.getByRole("heading", { name: /Authorized applications/i })
  await authorizedHeading.scrollIntoViewIfNeeded()
  await expect(authorizedHeading).toBeVisible()
}

/** Reset this user's authorization for our test client (clean slate for Suite 2) */
async function resetClientAuthorization(page: Page) {
  await openAuthorizedApps(page)
  // Try revoke by display name and client_id (in case the UI shows either)
  await revokeClientRow(page, APP_DISPLAY_NAME)
  await revokeClientRow(page, TEST_CLIENT_ID)
}

// ---------- DPoP helpers ----------
type DPoPKey = { privateKey: KeyLike; publicJwk: JWK }

async function createDPoPKey(): Promise<DPoPKey> {
  const { publicKey, privateKey } = await generateKeyPair("ES256")
  const publicJwk = await exportJWK(publicKey)
  publicJwk.alg = "ES256"
  return { privateKey, publicJwk }
}

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

function toB64Url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

/** Build a DPoP proof. Pass `ath` (base64url(sha256(access_token))) for resource requests. */
async function makeDPoP(method: string, url: string, key: DPoPKey, ath?: string): Promise<string> {
  const payload = {
    htm: method.toUpperCase(),
    htu: url,
    iat: nowSec(),
    jti: crypto.randomUUID(),
    ath: ath,
  }
  return await new SignJWT(payload)
    .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk: key.publicJwk })
    .sign(key.privateKey)
}

// ---------- Unified Token/UserInfo helpers ----------
type AuthMode = { kind: "dpop"; key: DPoPKey } | { kind: "bearer" }

async function exchangeCodeForToken(code: string, mode: AuthMode) {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    Accept: "application/json, application/x-www-form-urlencoded;q=0.9, */*;q=0.1",
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: TEST_CLIENT_ID,
  })

  body.set("client_secret", TEST_CLIENT_SECRET)

  if (mode.kind === "dpop") {
    headers.DPoP = await makeDPoP("POST", TOKEN, mode.key)
  }

  const resp = await fetch(TOKEN, { method: "POST", headers, body: body.toString() })
  const contentType = resp.headers.get("content-type") || ""
  const raw = await resp.text()

  const data = contentType.includes("application/json")
    ? JSON.parse(raw)
    : Object.fromEntries(new URLSearchParams(raw).entries())

  if (resp.status >= 400) {
    throw new Error(`Token endpoint error ${resp.status}: ${JSON.stringify(data)}`)
  }
  expect(data.access_token).toBeTruthy()
  return data as { access_token: string; token_type?: string }
}

async function callUserInfo(accessToken: string, mode: AuthMode) {
  const headers: Record<string, string> = { Accept: "application/json" }

  if (mode.kind === "dpop") {
    const ath = toB64Url(crypto.createHash("sha256").update(accessToken, "utf8").digest())
    headers.DPoP = await makeDPoP("GET", USERINFO, mode.key, ath)
    headers.Authorization = `DPoP ${accessToken}`
  } else {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const resp = await fetch(USERINFO, { method: "GET", headers })
  const text = await resp.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`userinfo response not JSON: status=${resp.status} body=${text}`)
  }
  expect(resp.status).toBe(200)
  expect(json.sub).toBeTruthy()
  return json
}

// ============================================================================
// SUITE 0: OIDC Discovery and JWKS
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

  // ---------- Small utils ----------
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

// ============================================================================
// SUITE 1: Not logged in — login happens inside OAuth flow (deterministic)
// ============================================================================
test.describe("OAuth flow (login during flow)", () => {
  test("DPoP: prompts for scopes, logs in, approves, exchanges code, and hits userinfo", async ({
    page,
  }) => {
    const { url, state, scopes } = oauthUrl(["openid", "email"])

    // Start at /authorize -> expect to hit /login?return_to
    await page.goto(url)
    await page.waitForURL(/\/login\?return_to=.*/)

    // Login
    await performLogin(page, USER_EMAIL, USER_PASSWORD)

    // Consent page
    const consent = new ConsentPage(page, scopes)
    const nameMatcher = new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`)
    await consent.expectVisible(nameMatcher)

    // Approve, assert callback, and extract the auth code
    await consent.approve()
    const code = await assertAndExtractCodeFromCallbackUrl(page, state)

    // --- DPoP flow ---
    const key = await createDPoPKey()
    const tok = await exchangeCodeForToken(code, { kind: "dpop", key })
    const userinfo = await callUserInfo(tok.access_token, { kind: "dpop", key })

    expect(userinfo.sub).toBeTruthy()
    expect(String(userinfo.email)).toMatch(/student1@example\.com$/i)
  })

  test("Bearer: prompts for scopes, logs in, approves, exchanges code, and hits userinfo", async ({
    page,
  }) => {
    const { url, state, scopes } = oauthUrl(["openid", "email"])

    await page.goto(url)
    await page.waitForURL(/\/login\?return_to=.*/)

    await performLogin(page, USER_EMAIL_2, USER_PASSWORD_2)

    const consent = new ConsentPage(page, scopes)
    const nameMatcher = new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`)
    await consent.expectVisible(nameMatcher)

    await consent.approve()
    const code = await assertAndExtractCodeFromCallbackUrl(page, state)

    // --- Bearer flow ---
    const tok = await exchangeCodeForToken(code, { kind: "bearer" })
    const userinfo = await callUserInfo(tok.access_token, { kind: "bearer" })

    expect(userinfo.sub).toBeTruthy()
  })
})

// ==========================================================================================
// SUITE 2: Already logged in (storage state) — first shows consent, second skips; revoke shows again
// ==========================================================================================
test.describe("OAuth flow (already logged in via storage state)", () => {
  let ctx: BrowserContext
  let page: Page

  test.beforeEach(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: STUDENT_STORAGE_STATE })
    page = await ctx.newPage()
    // Ensure there is NO pre-existing grant for our client
    await resetClientAuthorization(page)
  })

  test.afterEach(async () => {
    await ctx.close()
  })

  test("prompts on first run, then skips consent when scopes already granted (no token exchange here)", async () => {
    const scopes = ["openid", "profile"]

    // 1) First grant: consent + approve
    const first = oauthUrl(scopes)
    await page.goto(first.url)
    const consent = new ConsentPage(page, scopes)
    await consent.expectVisible(new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`))
    await consent.approve()
    await assertAndExtractCodeFromCallbackUrl(page, first.state)

    // 2) Same scopes again: immediate redirect to callback (no consent dialog)
    const second = oauthUrl(scopes)
    await page.goto(second.url)
    await assertAndExtractCodeFromCallbackUrl(page, second.state)
    await consent.expectNotPresent()
  })

  test("revoking application authorization causes consent to reappear next time", async () => {
    // Ensure a grant exists
    const scopes = ["openid"]
    const initial = oauthUrl(scopes)
    await page.goto(initial.url)
    const consent = new ConsentPage(page, scopes)
    await consent.expectVisible(new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`))
    await consent.approve()
    await assertAndExtractCodeFromCallbackUrl(page, initial.state)

    // Revoke in settings
    await resetClientAuthorization(page)

    // Visit authorize again — consent should appear (grant removed)
    const again = oauthUrl(scopes)
    await page.goto(again.url)
    const consent2 = new ConsentPage(page, scopes)
    await consent2.expectVisible(new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`))
  })
})
