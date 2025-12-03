import crypto from "crypto"
import { exportJWK, generateKeyPair, type JWK, SignJWT } from "jose"

type KeyLike = CryptoKey | import("crypto").KeyObject

export type DPoPKey = { privateKey: KeyLike; publicJwk: JWK }

export async function createDPoPKey(): Promise<DPoPKey> {
  const { publicKey, privateKey } = await generateKeyPair("ES256")
  const publicJwk = await exportJWK(publicKey)
  publicJwk.alg = "ES256"
  return { privateKey, publicJwk }
}

export function nowSec() {
  return Math.floor(Date.now() / 1000)
}

export function toB64Url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

/** Build a DPoP proof. Pass `ath` (base64url(sha256(access_token))) for resource requests. Pass `nonce` when server requires it. */
export async function makeDPoP(
  method: string,
  url: string,
  key: DPoPKey,
  ath?: string,
  nonce?: string,
): Promise<string> {
  const payload: Record<string, unknown> = {
    htm: method.toUpperCase(),
    htu: url,
    iat: nowSec(),
    jti: crypto.randomUUID(),
  }
  if (ath) {
    payload.ath = ath
  }
  if (nonce) {
    payload.nonce = nonce
  }
  return await new SignJWT(payload)
    .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk: key.publicJwk })
    .sign(key.privateKey)
}

export type AuthMode = { kind: "dpop"; key: DPoPKey } | { kind: "bearer" }
