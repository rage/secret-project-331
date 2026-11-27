// @vitest-environment node
import { randomBytes } from "node:crypto"

import { describe, expect, it } from "vitest"

import type { SandboxTokenPayload } from "./token"
import { openToken, sealToken } from "./token"

const NOW = 1_700_000_000_000
const key = randomBytes(32)
const payload: SandboxTokenPayload = {
  v: 1,
  url: "http://project-331.local/api/v0/exercise-services/grading/grading-update/abc",
  claim: "claim-jwt",
  points: ["1.1", "1.2"],
  nonce: "n1",
  exp: NOW + 60_000,
}

describe("sandbox token", () => {
  it("opens what it sealed", () => {
    expect(openToken(sealToken(payload, key), [key], NOW)).toEqual(payload)
  })

  it("does not show the claim in clear", () => {
    const token = sealToken(payload, key)
    expect(Buffer.from(token, "base64url").toString("latin1")).not.toContain("claim-jwt")
  })

  it("rejects a token with any byte changed", () => {
    const sealed = Buffer.from(sealToken(payload, key), "base64url")
    for (const index of [0, 20, sealed.length - 1]) {
      const tampered = Buffer.from(sealed)
      tampered[index] = (tampered[index] ?? 0) ^ 1
      expect(openToken(tampered.toString("base64url"), [key], NOW)).toBeNull()
    }
  })

  it("rejects garbage and empty tokens", () => {
    expect(openToken("", [key], NOW)).toBeNull()
    expect(openToken("not a token", [key], NOW)).toBeNull()
  })

  it("rejects an expired token", () => {
    expect(openToken(sealToken(payload, key), [key], payload.exp + 1)).toBeNull()
  })

  it("rejects a token sealed with another key", () => {
    expect(openToken(sealToken(payload, randomBytes(32)), [key], NOW)).toBeNull()
  })

  it("opens tokens sealed with a retired key during rotation", () => {
    const retired = randomBytes(32)
    expect(openToken(sealToken(payload, retired), [key, retired], NOW)).toEqual(payload)
  })
})
