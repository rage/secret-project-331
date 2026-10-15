import {
  DEVICE_AUTHORIZATION,
  DEVICE_CODE_GRANT_TYPE,
  EXERCISE_SERVICES_CLIENT,
  TOKEN,
} from "./constants"

export interface DeviceAuthorizationResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

/**
 * Call the RFC 8628 device authorization endpoint for a public device client.
 * Returns the parsed device/user codes and the verification URIs.
 */
export async function requestDeviceAuthorization(
  clientId: string,
  scope?: string,
): Promise<DeviceAuthorizationResponse> {
  const body = new URLSearchParams({ client_id: clientId })
  if (scope) {
    body.set("scope", scope)
  }
  const resp = await fetch(DEVICE_AUTHORIZATION, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  })
  if (resp.status !== 200) {
    throw new Error(`device_authorization failed: ${resp.status} ${await resp.text()}`)
  }
  return (await resp.json()) as DeviceAuthorizationResponse
}

export interface DeviceTokenResult {
  status: number
  // On success: the issued tokens. On a pending/slow_down/denied/expired poll: `error`.
  body: {
    access_token?: string
    refresh_token?: string
    token_type?: string
    error?: string
    [key: string]: unknown
  }
}

/**
 * Poll the token endpoint with the device_code grant. Does not assert on status:
 * RFC 8628 returns HTTP 400 with an `error` of authorization_pending / slow_down /
 * expired_token / access_denied while the flow is not yet complete, which callers
 * assert on directly.
 */
export async function pollDeviceToken(
  deviceCode: string,
  clientId: string,
): Promise<DeviceTokenResult> {
  const body = new URLSearchParams({
    grant_type: DEVICE_CODE_GRANT_TYPE,
    device_code: deviceCode,
    client_id: clientId,
  })
  const resp = await fetch(TOKEN, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  })
  const raw = await resp.text()
  const parsed = raw ? JSON.parse(raw) : {}
  return { status: resp.status, body: parsed }
}

export interface ClientApiResult {
  status: number
  body: unknown
}

/**
 * Call an exercise-services client endpoint (GET /courses) with a Bearer token.
 * Returns the raw status so callers can assert 200 / 401 / 403 without throwing.
 */
export async function callClientCourses(accessToken: string): Promise<ClientApiResult> {
  const resp = await fetch(`${EXERCISE_SERVICES_CLIENT}/courses`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const raw = await resp.text()
  let body: unknown = raw
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    // leave body as the raw string
  }
  return { status: resp.status, body }
}
