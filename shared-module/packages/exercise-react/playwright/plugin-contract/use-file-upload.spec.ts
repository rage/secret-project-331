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
const hookPath = fileURLToPath(new URL("../../src/react/hooks/useFileUpload.ts", import.meta.url))
const reactPath = fileURLToPath(new URL("../../node_modules/react/index.js", import.meta.url))
const reactDomClientPath = fileURLToPath(
  new URL("../../node_modules/react-dom/client.js", import.meta.url),
)
const bytes = Uint8Array.from([222, 173, 190, 239, 0, 127])
const expectedDigest = createHash("sha256").update(bytes).digest("hex")

let temporaryDirectory = ""
let browserBundle = ""

test.beforeAll(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "exercise-react-playwright-"))
  const entry = path.join(temporaryDirectory, "use-file-upload-browser-entry.tsx")
  const outDir = path.join(temporaryDirectory, "dist")
  await writeFile(
    entry,
    `
      import React, { useEffect } from ${JSON.stringify(reactPath)}
      import { createRoot } from ${JSON.stringify(reactDomClientPath)}
      import useFileUpload from ${JSON.stringify(hookPath)}

      const channel = new MessageChannel()
      globalThis.uploadSnapshot = null
      channel.port1.addEventListener("message", ({ data }) => {
        void (async () => {
          if (data?.message !== "file-upload") return
          const value = data.files instanceof Map ? data.files.get("hook.bin") : null
          globalThis.uploadSnapshot = {
            message: data.message,
            requestId: data.requestId ?? null,
            filesAreMap: data.files instanceof Map,
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
            urls: new Map([["hook.bin", "https://files.example/hook.bin"]]),
          })
        })()
      })
      channel.port1.start()
      channel.port2.start()

      function Harness() {
        const uploadFiles = useFileUpload(channel.port2)
        useEffect(() => {
          document.querySelector("#upload").dataset.ready = "true"
        }, [])
        const upload = async () => {
          const file = new File(
            [new Uint8Array([222, 173, 190, 239, 0, 127])],
            "hook.bin",
            { type: "application/octet-stream", lastModified: 1725000000000 },
          )
          const urls = await uploadFiles(new Map([["hook.bin", file]]))
          document.querySelector("#result").textContent = JSON.stringify({
            urlsAreMap: urls instanceof Map,
            resultUrl: urls.get("hook.bin") ?? null,
          })
        }
        return React.createElement(
          React.Fragment,
          null,
          React.createElement("button", { id: "upload", type: "button", onClick: upload }, "Upload"),
          React.createElement("output", { id: "result" }, "waiting"),
        )
      }

      createRoot(document.querySelector("#root")).render(React.createElement(Harness))
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
    throw new Error("tsdown did not produce the useFileUpload browser harness")
  }
  browserBundle = await readFile(path.join(outDir, outputName), "utf8")
})

test.afterAll(async () => {
  if (temporaryDirectory !== "") {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})

test("useFileUpload round-trips a genuine File and Map from a mounted React hook", async ({
  page,
}) => {
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
  await page.addScriptTag({ content: browserBundle })
  const upload = page.getByRole("button", { name: "Upload" })
  await expect(upload).toHaveAttribute("data-ready", "true")

  await upload.click()
  await expect(page.locator("#result")).toContainText("https://files.example/hook.bin")

  const result = JSON.parse((await page.locator("#result").textContent()) ?? "null")
  const snapshot = await page.evaluate(() => {
    return (globalThis as typeof globalThis & { uploadSnapshot?: unknown }).uploadSnapshot
  })
  expect(result).toEqual({
    urlsAreMap: true,
    resultUrl: "https://files.example/hook.bin",
  })
  expect(snapshot).toEqual({
    message: "file-upload",
    requestId: "file-upload-1",
    filesAreMap: true,
    valueIsFile: true,
    name: "hook.bin",
    type: "application/octet-stream",
    size: bytes.byteLength,
    lastModified: 1_725_000_000_000,
    bytes: [...bytes],
  })
  expect(
    createHash("sha256")
      .update(Uint8Array.from((snapshot as { bytes: number[] }).bytes))
      .digest("hex"),
  ).toBe(expectedDigest)
})
