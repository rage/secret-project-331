import { promises as fs } from "fs"

import { afterEach, describe, expect, it, vi } from "vitest"

import { compressProject } from "@/tmc/langs"

import { handlePackBrowserAnswer } from "./packBrowserAnswer"

/** Relative path -> contents of everything present when the packer ran; the dir is gone after. */
const packed = new Map<string, string>()

// tmc-langs is a CLI subprocess; stub it so the packing can be driven in-process. The stub snapshots
// the directory it was handed — the handler deletes it before returning — and writes a recognisable
// archive so the returned bytes can be traced back to here.
vi.mock("@/tmc/langs", () => ({
  compressProject: vi.fn(async (exercisePath: string, outputPath: string) => {
    const entries = await fs.readdir(exercisePath, { recursive: true, withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile()) {
        const full = `${entry.parentPath}/${entry.name}`
        packed.set(full.slice(exercisePath.length + 1), await fs.readFile(full, "utf8"))
      }
    }
    await fs.writeFile(outputPath, "packed-archive")
    return "checksum-abc123"
  }),
}))
vi.mock("@/shared-module/common/errors/reportErrorOccurrence", () => ({
  reportErrorOccurrence: vi.fn(() => Promise.resolve(undefined)),
}))

function post(body: unknown): Request {
  return new Request("http://localhost/api/pack-browser-answer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

afterEach(() => {
  vi.mocked(compressProject).mockClear()
  packed.clear()
})

describe("POST /api/pack-browser-answer", () => {
  it("returns the packed archive's bytes", async () => {
    const res = await handlePackBrowserAnswer(
      post([{ filepath: "src/main.py", contents: "print(1)" }]),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/x-zstd-compressed-tar")
    expect(await res.text()).toBe("packed-archive")
  })

  it("writes every answer file, at its own path, into the directory it packs", async () => {
    await handlePackBrowserAnswer(
      post([
        { filepath: "src/main.py", contents: "print(1)" },
        { filepath: "nested/deep/util.py", contents: "x = 2" },
      ]),
    )
    expect(Object.fromEntries(packed)).toEqual({
      "src/main.py": "print(1)",
      "nested/deep/util.py": "x = 2",
    })
  })

  it("refuses a filepath that escapes the packed directory", async () => {
    const res = await handlePackBrowserAnswer(
      post([{ filepath: "../escaped.py", contents: "pwned" }]),
    )
    expect(res.status).toBe(500)
    expect(vi.mocked(compressProject)).not.toHaveBeenCalled()
  })

  it("rejects an answer with no files, which cannot become a submittable archive", async () => {
    const res = await handlePackBrowserAnswer(post([]))
    expect(res.status).toBe(400)
    expect(vi.mocked(compressProject)).not.toHaveBeenCalled()
  })

  it("rejects a malformed file entry", async () => {
    const res = await handlePackBrowserAnswer(post([{ filepath: "a.py" }]))
    expect(res.status).toBe(400)
  })

  it("rejects a body that is not JSON", async () => {
    const res = await handlePackBrowserAnswer(post("not json"))
    expect(res.status).toBe(400)
  })
})
