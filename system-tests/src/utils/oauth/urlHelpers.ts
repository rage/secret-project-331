import crypto from "crypto"

import { AUTHORIZE, REDIRECT_URI, TEST_CLIENT_ID } from "./constants"
import { ensureRedirectServer } from "./redirectServer"

export interface OAuthUrlOptions {
  codeChallenge?: string
  codeChallengeMethod?: string
}

export async function oauthUrl(scopes: string[], options?: OAuthUrlOptions) {
  // Ensure redirect server is set up before generating OAuth URLs
  await ensureRedirectServer()

  const state = crypto.randomBytes(9).toString("hex")
  const params = new URLSearchParams({
    response_type: "code",
    client_id: TEST_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: scopes.join(" "),
    state,
  })

  if (options?.codeChallenge) {
    params.set("code_challenge", options.codeChallenge)
    params.set("code_challenge_method", options.codeChallengeMethod || "S256")
  }

  return { url: `${AUTHORIZE}?${params.toString()}`, state, scopes }
}
