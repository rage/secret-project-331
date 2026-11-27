// @vitest-environment node
import { existsSync } from "node:fs"

import { describe, expect, it, vi } from "vitest"

import { TemplateError, withPreparedSubmission } from "./preparedSubmission"

vi.mock("@/lib", () => ({ downloadStream: vi.fn(() => Promise.resolve()) }))

let templateExistedWhenRead: boolean | null = null
vi.mock("@/tmc/langs", () => ({
  extractProject: vi.fn(() => Promise.resolve()),
  fastAvailablePoints: vi.fn(() => Promise.reject(new Error("no points"))),
  getTestsTimeoutMs: vi.fn(
    (templatePath: string) =>
      new Promise((resolve) => {
        setTimeout(() => {
          templateExistedWhenRead = existsSync(templatePath)
          resolve(1000)
        }, 50)
      }),
  ),
  prepareSubmission: vi.fn(),
}))

const SOURCE = {
  answer: { name: "answer.tar.zst", mime: "application/zstd", downloadUrl: "http://lms/a" },
  templateDownloadUrl: "http://lms/t",
}

describe("withPreparedSubmission", () => {
  it("keeps the template until both of its reads settle", async () => {
    await expect(withPreparedSubmission(SOURCE, () => Promise.resolve())).rejects.toBeInstanceOf(
      TemplateError,
    )
    expect(templateExistedWhenRead).toBe(true)
  })
})
