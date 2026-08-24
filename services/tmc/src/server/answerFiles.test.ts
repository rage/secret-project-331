import { promises as fs } from "fs"

import { afterEach, describe, expect, it, vi } from "vitest"

import { compressProject } from "@/tmc/langs"

import { handleAnswerFiles } from "./answerFiles"

/** Relative path -> contents of everything present when the packer ran; the dir is gone after. */
const packed = new Map<string, string>()

// tmc-langs is a CLI subprocess; stub it so the packing can be driven in-process. The stub snapshots
// the directory it was handed — the handler deletes it before returning — and writes a recognisable
// archive so the reported bytes can be traced back to here.
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
  return new Request("http://localhost/api/answer-files", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const decode = (data: string) => Buffer.from(data, "base64").toString("utf8")

const browserAnswer = (files: { filepath: string; contents: string }[]) => ({
  request_id: "req",
  public_spec: { type: "browser", archive_name: "part01-ex01.tar.zst" },
  answer: { type: "browser", files },
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(compressProject).mockClear()
  packed.clear()
})

describe("POST /api/answer-files", () => {
  // A native client submits exactly one archive, so a browser answer has to report one too or the
  // same submission would download as N files from one origin and 1 from the other.
  it("packs a browser answer into a single archive named by the public spec", async () => {
    const res = await handleAnswerFiles(
      post(
        browserAnswer([
          { filepath: "src/main.py", contents: "print(1)" },
          { filepath: "src/util.py", contents: "x = 2" },
        ]),
      ),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.files).toHaveLength(1)
    expect(body.files[0].name).toBe("part01-ex01.tar.zst")
    expect(decode(body.files[0].data)).toBe("packed-archive")
  })

  it("writes every answer file, at its own path, into the directory it packs", async () => {
    await handleAnswerFiles(
      post(
        browserAnswer([
          { filepath: "src/main.py", contents: "print(1)" },
          { filepath: "nested/deep/util.py", contents: "x = 2" },
        ]),
      ),
    )
    expect(Object.fromEntries(packed)).toEqual({
      "src/main.py": "print(1)",
      "nested/deep/util.py": "x = 2",
    })
  })

  it("refuses a filepath that escapes the packed directory", async () => {
    const res = await handleAnswerFiles(
      post(browserAnswer([{ filepath: "../escaped.py", contents: "pwned" }])),
    )
    expect(res.status).toBe(500)
    expect(vi.mocked(compressProject)).not.toHaveBeenCalled()
  })

  it("falls back to a default archive name when the public spec names none", async () => {
    const res = await handleAnswerFiles(
      post({
        request_id: "req",
        public_spec: null,
        answer: { type: "browser", files: [{ filepath: "a.py", contents: "x" }] },
      }),
    )
    expect(res.status).toBe(200)
    expect((await res.json()).files[0].name).toBe("submission.tar.zst")
  })

  it("reports an answer with no files as an empty list rather than packing an empty archive", async () => {
    const res = await handleAnswerFiles(post(browserAnswer([])))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ files: [] })
    expect(vi.mocked(compressProject)).not.toHaveBeenCalled()
  })

  it("reports an editor answer's stored archive as that same single file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))),
    )
    const res = await handleAnswerFiles(
      post({
        request_id: "req",
        public_spec: { type: "editor", archive_name: "part01-ex01.tar.zst" },
        answer: { type: "editor", archive_download_url: "http://project-331.local/archive" },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.files).toHaveLength(1)
    expect(body.files[0].name).toBe("part01-ex01.tar.zst")
    expect([...Buffer.from(body.files[0].data, "base64")]).toEqual([1, 2, 3])
  })

  it("reports a failure to fetch the archive rather than an empty file list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("gone", { status: 404 }))),
    )
    const res = await handleAnswerFiles(
      post({
        request_id: "req",
        public_spec: null,
        answer: { type: "editor", archive_download_url: "http://project-331.local/archive" },
      }),
    )
    expect(res.status).toBe(500)
  })

  it("rejects an answer of an unknown type", async () => {
    const res = await handleAnswerFiles(
      post({ request_id: "req", public_spec: null, answer: { type: "something-else" } }),
    )
    expect(res.status).toBe(400)
  })

  it("rejects a body that is not JSON", async () => {
    const res = await handleAnswerFiles(post("not json"))
    expect(res.status).toBe(400)
  })
})
