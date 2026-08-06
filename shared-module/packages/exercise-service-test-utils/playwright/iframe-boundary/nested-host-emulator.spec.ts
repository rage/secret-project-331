import { Buffer } from "node:buffer"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { expect, test as base } from "@playwright/test"

import { createNestedHostEmulator } from "../../src/playwright/createHostEmulator"
import { withBrowserDiagnostics } from "../fixtures/diagnostics"

const test = withBrowserDiagnostics(base)

let hostServer: Server
let iframeServer: Server
let hostUrl: string
let iframeUrl: string

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

test.beforeAll(async () => {
  hostServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    response.end("<!doctype html><title>Host</title><main>Distinct-origin test host</main>")
  })
  iframeServer = createServer((_request, response) => {
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
            const files = new Map()
            for (const file of changeEvent.currentTarget.files) files.set(file.name, file)
            port.postMessage({ message: "file-upload", requestId: "nested-upload", files })
          })
        })
        parent.postMessage("ready", "*")
      </script>`)
  })
  hostUrl = await listen(hostServer)
  iframeUrl = await listen(iframeServer)
})

test.afterAll(async () => {
  await Promise.all([close(hostServer), close(iframeServer)])
})

test("preserves File metadata and bytes across a sandboxed distinct-origin iframe", async ({
  page,
}) => {
  const host = await createNestedHostEmulator(page, {
    hostUrl,
    iframeUrl,
    iframeTitle: "Boundary plugin",
    autoUpload: false,
  })

  await expect(host.iframe).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-forms allow-downloads allow-same-origin",
  )
  await expect(host.iframe).toHaveAttribute("title", "Boundary plugin")
  await expect(host.frame.locator("#upload")).toBeVisible()

  await host.driveFileUpload({
    name: "boundary.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("boundary-bytes"),
  })

  const upload = await host.waitForFileUpload()
  expect(upload).toMatchObject({
    requestId: "nested-upload",
    filesKind: "map",
    entries: [
      {
        key: "boundary.bin",
        kind: "file",
        name: "boundary.bin",
        type: "application/octet-stream",
        size: 14,
        sha256: "21266c9e5880968bf99aacb360105effbe293d1e4789dd0ca410d618f5f32b5b",
      },
    ],
  })
})
