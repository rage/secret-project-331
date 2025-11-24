import { INTROSPECT, TEST_CLIENT_ID, TEST_CLIENT_SECRET } from "./constants"

export interface IntrospectResponse {
  active: boolean
  scope?: string
  client_id?: string
  username?: string
  exp?: number
  iat?: number
  sub?: string
  aud?: string[]
  iss?: string
  jti?: string
  token_type?: string
}

export interface IntrospectOptions {
  clientId?: string
  clientSecret?: string
}

/**
 * Introspect an OAuth access token using the introspection endpoint (RFC 7662).
 *
 * @param token - The access token to introspect
 * @param options - Optional client credentials (defaults to test client)
 * @returns The introspection response
 */
export async function introspectToken(
  token: string,
  options?: IntrospectOptions,
): Promise<IntrospectResponse> {
  const clientId = options?.clientId ?? TEST_CLIENT_ID
  const clientSecret = options?.clientSecret ?? TEST_CLIENT_SECRET

  const body = new URLSearchParams({
    token,
    client_id: clientId,
  })

  if (clientSecret) {
    body.set("client_secret", clientSecret)
  }

  const response = await fetch(INTROSPECT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(`Introspection failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}
