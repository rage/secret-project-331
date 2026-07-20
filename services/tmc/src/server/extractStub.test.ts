import { readFile } from "node:fs/promises"

import { afterEach, describe, expect, it, vi } from "vitest"

import { handleExtractStub } from "./extractStub"

function post(body: string): Request {
  return new Request("http://localhost/api/extract-stub", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("POST /api/extract-stub", () => {
  it("rejects invalid JSON with 400", async () => {
    const res = await handleExtractStub(post("not json"))
    expect(res.status).toBe(400)
  })

  it("rejects a missing stub_download_url with 400", async () => {
    const res = await handleExtractStub(post(JSON.stringify({})))
    expect(res.status).toBe(400)
  })

  it("downloads and extracts a tar.zst stub into files", async () => {
    // Serve the real fixture for the stub URL; everything else (zstddec fetching its own wasm)
    // falls through to real fetch.
    const archive = await readFile("./tests/util/test.tar.zst")
    const realFetch = globalThis.fetch
    vi.stubGlobal(
      "fetch",
      (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        if (String(input).startsWith("http://stub.example/")) {
          return Promise.resolve(new Response(new Uint8Array(archive)))
        }
        return realFetch(input, init)
      },
    )

    const res = await handleExtractStub(
      post(JSON.stringify({ stub_download_url: "http://stub.example/stub.tar.zst" })),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { files: { filepath: string; contents: string }[] }
    expect(body.files).toHaveLength(1)
    // safe: toHaveLength(1) asserted above
    expect(body.files[0]!.contents).toBe("hello!\n")
  })
})
