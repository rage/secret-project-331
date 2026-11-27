// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

import { packAnswerArchive } from "@/util/canonicalArchive"

const load = vi.fn()
vi.mock("@hpcc-js/wasm-zstd", () => ({ Zstd: { load: () => load() } }))

describe("packAnswerArchive", () => {
  it("loads zstd again after a failed load", async () => {
    load
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ compress: (data: Uint8Array) => data })
    await expect(packAnswerArchive("ex", [])).rejects.toThrow("offline")
    await expect(packAnswerArchive("ex", [])).resolves.toBeInstanceOf(File)
  })
})
