import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { z } from "zod"

const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12
const TAG_BYTES = 16
const AAD = Buffer.from("tmc-sandbox-v1")

const tokenPayloadSchema = z.object({
  v: z.literal(1),
  url: z.string(),
  claim: z.string().nullable(),
  points: z.array(z.string()),
  nonce: z.string(),
  /** Unix milliseconds. */
  exp: z.number(),
})

/**
 * What the sandbox carries back to `/api/sandbox-results`: everything needed to report the result,
 * so a callback still lands after this service restarts. Sealed, because the grading-update claim
 * is a write capability for the submission.
 */
export type SandboxTokenPayload = z.infer<typeof tokenPayloadSchema>

/** Encrypts and authenticates `payload` with `key` as base64url. */
export function sealToken(payload: SandboxTokenPayload, key: Buffer): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  cipher.setAAD(AAD)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()])
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64url")
}

/**
 * The payload of a token one of `keys` sealed, or null when none did, it was altered, or its
 * `exp` is before `nowMs`.
 */
export function openToken(
  token: string,
  keys: Buffer[],
  nowMs: number,
): SandboxTokenPayload | null {
  const sealed = Buffer.from(token, "base64url")
  if (sealed.length <= IV_BYTES + TAG_BYTES) {
    return null
  }
  const iv = sealed.subarray(0, IV_BYTES)
  const ciphertext = sealed.subarray(IV_BYTES, sealed.length - TAG_BYTES)
  const tag = sealed.subarray(sealed.length - TAG_BYTES)
  for (const key of keys) {
    let plaintext: string
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv)
      decipher.setAAD(AAD)
      decipher.setAuthTag(tag)
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
    } catch {
      continue
    }
    const parsed = tokenPayloadSchema.safeParse(JSON.parse(plaintext))
    if (!parsed.success || parsed.data.exp < nowMs) {
      return null
    }
    return parsed.data
  }
  return null
}

/** A fresh random nonce, which tells one dispatch's callback from another's. */
export function newNonce(): string {
  return randomBytes(16).toString("base64url")
}
