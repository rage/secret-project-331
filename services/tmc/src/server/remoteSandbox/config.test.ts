// @vitest-environment node
import { describe, expect, it } from "vitest"

import { GradingConfigError, parseRemoteSandboxConfig, validateGradingConfig } from "./config"

const KEY = Buffer.alloc(32, 7).toString("base64")
const VALID = {
  TMC_GRADING_SANDBOX: "remote",
  TMC_REMOTE_SANDBOX_URLS: "https://sandbox1.example/, http://user:p%40ss@sandbox2.example:3000",
  TMC_REMOTE_SANDBOX_NOTIFY_URL: "https://courses.mooc.fi/tmc/api/sandbox-results",
  TMC_REMOTE_SANDBOX_NOTIFY_SECRET: "secret",
  TMC_REMOTE_SANDBOX_TOKEN_KEY: `${KEY},${Buffer.alloc(32, 8).toString("base64")}`,
}

function parseWithMalformedUrl() {
  return parseRemoteSandboxConfig({ ...VALID, TMC_REMOTE_SANDBOX_URLS: "ftp://user:hunter2@x" })
}

describe("grading sandbox configuration", () => {
  it("accepts pod mode with nothing else set", () => {
    expect(() => validateGradingConfig({})).not.toThrow()
    expect(() => validateGradingConfig({ TMC_GRADING_SANDBOX: "pod" })).not.toThrow()
  })

  it("rejects an unknown mode", () => {
    expect(() => validateGradingConfig({ TMC_GRADING_SANDBOX: "cloud" })).toThrow(
      GradingConfigError,
    )
  })

  it("rejects remote mode without its settings", () => {
    expect(() => validateGradingConfig({ TMC_GRADING_SANDBOX: "remote" })).toThrow(
      /TMC_REMOTE_SANDBOX_URLS.*TMC_REMOTE_SANDBOX_NOTIFY_URL.*TMC_REMOTE_SANDBOX_TOKEN_KEY/,
    )
  })

  it("parses servers, moving URL credentials into a basic auth header", () => {
    const config = parseRemoteSandboxConfig(VALID)
    expect(config.servers).toEqual([
      { baseUrl: "https://sandbox1.example", authorization: null },
      {
        baseUrl: "http://sandbox2.example:3000",
        authorization: `Basic ${Buffer.from("user:p@ss").toString("base64")}`,
      },
    ])
    expect(config.notifySecret).toBe("secret")
    expect(config.tokenKeys).toHaveLength(2)
  })

  it("does not echo a malformed URL, which can carry credentials", () => {
    expect(parseWithMalformedUrl).toThrow(GradingConfigError)
    expect(parseWithMalformedUrl).not.toThrow(/hunter2/)
  })

  it("rejects a token key that is not 32 bytes", () => {
    expect(() =>
      parseRemoteSandboxConfig({
        ...VALID,
        TMC_REMOTE_SANDBOX_TOKEN_KEY: Buffer.alloc(16).toString("base64"),
      }),
    ).toThrow(/TMC_REMOTE_SANDBOX_TOKEN_KEY/)
  })

  it("rejects a notify URL with credentials", () => {
    expect(() =>
      parseRemoteSandboxConfig({
        ...VALID,
        TMC_REMOTE_SANDBOX_NOTIFY_URL: "https://a:b@courses.mooc.fi/tmc/api/sandbox-results",
      }),
    ).toThrow(/TMC_REMOTE_SANDBOX_NOTIFY_URL/)
  })

  it("leaves requests unsigned without a notify secret", () => {
    const { TMC_REMOTE_SANDBOX_NOTIFY_SECRET: _secret, ...unsigned } = VALID
    expect(parseRemoteSandboxConfig(unsigned).notifySecret).toBeNull()
  })
})
