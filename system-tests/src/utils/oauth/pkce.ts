import crypto from "crypto"

/**
 * Generate a random code verifier for PKCE (RFC 7636).
 * Returns a URL-safe string of 43-128 characters.
 */
export function generateCodeVerifier(): string {
  // Generate 32 random bytes (256 bits) and base64url encode
  // This gives us 43 characters, which is the minimum length
  const randomBytes = crypto.randomBytes(32)
  return randomBytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

/**
 * Generate a code challenge from a code verifier using S256 method (SHA-256).
 * Returns a base64url-encoded SHA-256 hash of the verifier.
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier, "utf8").digest()
  return hash.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}
