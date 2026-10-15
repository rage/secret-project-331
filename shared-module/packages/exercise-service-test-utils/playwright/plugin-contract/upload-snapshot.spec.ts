import { Buffer } from "node:buffer"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { expect, test as base } from "@playwright/test"

import { createHostEmulator } from "../../src/playwright/createHostEmulator"
import { withBrowserDiagnostics } from "../fixtures/diagnostics"

const test = withBrowserDiagnostics(base)

let pluginServer: Server
let pluginUrl: string

// Served over loopback because the emulator hashes with Web Crypto, which needs a secure context;
// `page.setContent` alone would leave the page on the opaque about:blank origin.
test.beforeAll(async () => {
  pluginServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    response.end(`<!doctype html>
      <title>Plugin</title>
      <input id="upload" type="file">
      <script>
        window.addEventListener("message", (event) => {
          if (event.data !== "communication-port" || !event.ports[0]) return
          const port = event.ports[0]
          port.start()
          document.querySelector("#upload").addEventListener("change", (changeEvent) => {
            port.postMessage({
              message: "file-upload",
              requestId: "contract-upload",
              files: [...changeEvent.currentTarget.files],
            })
          })
        })
      </script>`)
  })
  await new Promise<void>((resolve, reject) => {
    pluginServer.once("error", reject)
    pluginServer.listen(0, "127.0.0.1", resolve)
  })
  pluginUrl = `http://127.0.0.1:${(pluginServer.address() as AddressInfo).port}`
})

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    pluginServer.close((error) => (error ? reject(error) : resolve()))
  })
})

test("captures exact File bytes before Playwright serialization", async ({ page }) => {
  await page.goto(pluginUrl)

  const host = await createHostEmulator(page, { autoUpload: false })
  await page.evaluate(() => window.postMessage("ready", "*"))
  await host.driveFileUpload(
    {
      name: "answer.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    },
    page.locator("#upload"),
  )

  const upload = await host.waitForFileUpload(
    (candidate) => candidate.requestId === "contract-upload",
  )
  expect(upload).toMatchObject({
    requestId: "contract-upload",
    filesKind: "array",
    entries: [
      {
        key: "0",
        kind: "file",
        name: "answer.txt",
        type: "text/plain",
        size: 5,
        sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      },
    ],
  })
  expect(upload.entries[0]?.lastModified).toEqual(expect.any(Number))
  expect(await host.fileUploadCount()).toBe(1)

  await host.reset()
  expect(await host.fileUploadCount()).toBe(0)
})
