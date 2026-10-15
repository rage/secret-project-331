import { createHash } from "node:crypto"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test as base } from "@playwright/test"
import { build } from "tsdown"

import { withBrowserDiagnostics } from "../../../exercise-service-test-utils/playwright/fixtures/diagnostics"

const test = withBrowserDiagnostics(base)
const packageRoot = fileURLToPath(new URL("../..", import.meta.url))
const parentUploadPath = fileURLToPath(new URL("../../src/client/parentUpload.ts", import.meta.url))
const bytes = Uint8Array.from([0, 17, 34, 51, 255, 128])
const expectedDigest = createHash("sha256").update(bytes).digest("hex")

let temporaryDirectory = ""
let browserBundle = ""

test.beforeAll(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "exercise-client-playwright-"))
  const entry = path.join(temporaryDirectory, "parent-upload-browser-entry.ts")
  const outDir = path.join(temporaryDirectory, "dist")
  await writeFile(
    entry,
    `
      import { ParentUploadClient } from ${JSON.stringify(parentUploadPath)}

      globalThis.runParentUploadContract = async () => {
        const channel = new MessageChannel()
        let uploadSnapshot = null
        channel.port1.addEventListener("message", ({ data }) => {
          void (async () => {
            if (data?.message !== "file-upload") return
            const value = Array.isArray(data.files) ? data.files[0] : null
            uploadSnapshot = {
              message: data.message,
              requestId: data.requestId ?? null,
              filesAreArray: Array.isArray(data.files),
              fileCount: Array.isArray(data.files) ? data.files.length : null,
              valueIsFile: value instanceof File,
              name: value instanceof File ? value.name : null,
              type: value instanceof Blob ? value.type : null,
              size: value instanceof Blob ? value.size : null,
              lastModified: value instanceof File ? value.lastModified : null,
              bytes: value instanceof Blob
                ? [...new Uint8Array(await value.arrayBuffer())]
                : null,
            }
            channel.port1.postMessage({
              message: "upload-result",
              requestId: data.requestId,
              success: true,
              files: [
                {
                  id: "0f1d7b2e-1f4a-4c53-9a9e-4d3d3f1b0c11",
                  url: "https://files.example/sample.bin",
                },
              ],
            })
          })()
        })
        channel.port1.start()
        const client = new ParentUploadClient(channel.port2, { timeoutMs: 2_000 })
        channel.port2.start()
        const file = new File(
          [new Uint8Array([0, 17, 34, 51, 255, 128])],
          "sample.bin",
          { type: "application/octet-stream", lastModified: 1725000000000 },
        )
        const uploaded = await client.uploadFiles([file])
        client.dispose()
        return {
          uploadSnapshot,
          uploadedCount: uploaded.length,
          resultRequestId: uploaded[0]?.requestId ?? null,
          resultId: uploaded[0]?.id ?? null,
          resultUrl: uploaded[0]?.url ?? null,
          // The client must pair the URL back to the very File the caller passed in, not a copy.
          resultFileIsInput: uploaded[0]?.file === file,
        }
      }
    `,
    "utf8",
  )
  await build({
    config: false,
    cwd: packageRoot,
    entry: [entry],
    outDir,
    format: "iife",
    platform: "browser",
    target: "es2022",
    dts: false,
    sourcemap: false,
    clean: false,
    unbundle: false,
    deps: { alwaysBundle: [/.*/] },
  })
  const outputName = (await readdir(outDir)).find((name) => name.endsWith(".js"))
  if (outputName === undefined) {
    throw new Error("tsdown did not produce the ParentUploadClient browser harness")
  }
  browserBundle = await readFile(path.join(outDir, outputName), "utf8")
})

test.afterAll(async () => {
  if (temporaryDirectory !== "") {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})

test("ParentUploadClient round-trips a genuine File through MessageChannel", async ({ page }) => {
  await page.setContent("<!doctype html><html><body></body></html>")
  await page.addScriptTag({ content: browserBundle })

  const result = await page.evaluate(async () => {
    return await (
      globalThis as typeof globalThis & {
        runParentUploadContract: () => Promise<unknown>
      }
    ).runParentUploadContract()
  })

  expect(result).toEqual({
    uploadSnapshot: {
      message: "file-upload",
      requestId: "file-upload-1",
      filesAreArray: true,
      fileCount: 1,
      valueIsFile: true,
      name: "sample.bin",
      type: "application/octet-stream",
      size: bytes.byteLength,
      lastModified: 1_725_000_000_000,
      bytes: [...bytes],
    },
    uploadedCount: 1,
    resultRequestId: "file-upload-1",
    resultId: "0f1d7b2e-1f4a-4c53-9a9e-4d3d3f1b0c11",
    resultUrl: "https://files.example/sample.bin",
    resultFileIsInput: true,
  })
  expect(
    createHash("sha256")
      .update(
        Uint8Array.from((result as { uploadSnapshot: { bytes: number[] } }).uploadSnapshot.bytes),
      )
      .digest("hex"),
  ).toBe(expectedDigest)
})
