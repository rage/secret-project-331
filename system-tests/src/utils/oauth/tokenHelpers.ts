import crypto from "crypto"

import { expect } from "@playwright/test"

import { TEST_CLIENT_ID, TEST_CLIENT_SECRET, TOKEN, USERINFO } from "./constants"
import { type AuthMode, makeDPoP, toB64Url } from "./dpop"
import { getRedirectUri } from "./redirectServer"

export async function exchangeCodeForToken(code: string, mode: AuthMode, codeVerifier?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    Accept: "application/json, application/x-www-form-urlencoded;q=0.9, */*;q=0.1",
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    client_id: TEST_CLIENT_ID,
  })

  body.set("client_secret", TEST_CLIENT_SECRET)

  if (codeVerifier) {
    body.set("code_verifier", codeVerifier)
  }

  // For DPoP, we may need to retry with a nonce if the server requires it
  if (mode.kind === "dpop") {
    headers.DPoP = await makeDPoP("POST", TOKEN, mode.key)
  }

  let resp = await fetch(TOKEN, { method: "POST", headers, body: body.toString() })
  let contentType = resp.headers.get("content-type") || ""
  let raw = await resp.text()

  let data = contentType.includes("application/json")
    ? JSON.parse(raw)
    : Object.fromEntries(new URLSearchParams(raw).entries())

  // Handle DPoP nonce requirement
  if (resp.status === 401 && mode.kind === "dpop" && data.error === "use_dpop_nonce") {
    const dpopNonce = resp.headers.get("DPoP-Nonce")
    if (dpopNonce) {
      // Retry with the nonce
      headers.DPoP = await makeDPoP("POST", TOKEN, mode.key, undefined, dpopNonce)
      resp = await fetch(TOKEN, { method: "POST", headers, body: body.toString() })
      contentType = resp.headers.get("content-type") || ""
      raw = await resp.text()
      data = contentType.includes("application/json")
        ? JSON.parse(raw)
        : Object.fromEntries(new URLSearchParams(raw).entries())
    }
  }

  expect(resp.status).toBeLessThan(400)
  expect(data.access_token).toBeTruthy()
  return data as { access_token: string; refresh_token?: string; token_type?: string }
}

export interface RefreshGrantResponse {
  status: number
  data: {
    access_token?: string
    refresh_token?: string
    error?: string
    [key: string]: unknown
  }
}

/**
 * Redeem a refresh token at the /token endpoint with the test client's credentials.
 * Returns the status and parsed body without asserting, so error cases can be checked too.
 */
export async function redeemRefreshToken(refreshToken: string): Promise<RefreshGrantResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: TEST_CLIENT_ID,
    client_secret: TEST_CLIENT_SECRET,
  })

  const resp = await fetch(TOKEN, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  })

  return { status: resp.status, data: await resp.json() }
}

interface UserInfoResponse {
  sub: string
  [key: string]: unknown
}

interface DPoPErrorResponse {
  error?: string
  [key: string]: unknown
}

export async function callUserInfo(accessToken: string, mode: AuthMode) {
  const headers: Record<string, string> = { Accept: "application/json" }

  if (mode.kind === "dpop") {
    const ath = toB64Url(crypto.createHash("sha256").update(accessToken, "utf8").digest())
    headers.DPoP = await makeDPoP("GET", USERINFO, mode.key, ath)
    headers.Authorization = `DPoP ${accessToken}`
  } else {
    headers.Authorization = `Bearer ${accessToken}`
  }

  let resp = await fetch(USERINFO, { method: "GET", headers })
  let text = await resp.text()

  // Handle DPoP nonce requirement
  if (resp.status === 401 && mode.kind === "dpop") {
    const initialJson = JSON.parse(text) as DPoPErrorResponse
    if (initialJson.error === "use_dpop_nonce") {
      const dpopNonce = resp.headers.get("DPoP-Nonce")
      if (dpopNonce) {
        // Retry with the nonce
        const ath = toB64Url(crypto.createHash("sha256").update(accessToken, "utf8").digest())
        headers.DPoP = await makeDPoP("GET", USERINFO, mode.key, ath, dpopNonce)
        resp = await fetch(USERINFO, { method: "GET", headers })
        text = await resp.text()
      }
    }
  }

  expect(resp.status).toBe(200)
  expect(() => JSON.parse(text)).not.toThrow()
  const json = JSON.parse(text) as UserInfoResponse
  expect(json.sub).toBeTruthy()
  return json
}
