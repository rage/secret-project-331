import { REVOKE, TEST_CLIENT_ID, TEST_CLIENT_SECRET } from "./constants"

export interface RevokeTokenParams {
  token: string
  token_type_hint?: "access_token" | "refresh_token"
  client_id?: string
  client_secret?: string
}

export interface RevokeTokenResponse {
  status: number
  body: string
}

/**
 * Call the OAuth 2.0 token revocation endpoint (RFC 7009)
 */
export async function revokeToken(params: RevokeTokenParams): Promise<RevokeTokenResponse> {
  const body = new URLSearchParams({
    token: params.token,
    client_id: params.client_id ?? TEST_CLIENT_ID,
  })

  if (params.client_secret !== undefined) {
    body.set("client_secret", params.client_secret)
  } else if (params.client_id === undefined || params.client_id === TEST_CLIENT_ID) {
    // Use default secret if using default client
    body.set("client_secret", TEST_CLIENT_SECRET)
  }

  if (params.token_type_hint) {
    body.set("token_type_hint", params.token_type_hint)
  }

  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    Accept: "application/json, application/x-www-form-urlencoded;q=0.9, */*;q=0.1",
  }

  const resp = await fetch(REVOKE, { method: "POST", headers, body: body.toString() })
  const bodyText = await resp.text()

  return {
    status: resp.status,
    body: bodyText,
  }
}
