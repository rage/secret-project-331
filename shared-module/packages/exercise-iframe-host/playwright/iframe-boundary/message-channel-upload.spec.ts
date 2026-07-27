import { createHash } from "node:crypto"
import { createServer, type Server } from "node:http"
import { fileURLToPath } from "node:url"

import { expect, test as base } from "@playwright/test"
import react from "@vitejs/plugin-react"
import { build } from "vite"

import { withBrowserDiagnostics } from "../../../exercise-service-test-utils/playwright/fixtures/diagnostics"

const test = withBrowserDiagnostics(base)

const componentPath = fileURLToPath(new URL("../../src/MessageChannelIFrame.tsx", import.meta.url))
const fileBytes = Uint8Array.from([0, 1, 2, 3, 255, 128, 64])
const expectedDigest = createHash("sha256").update(fileBytes).digest("hex")

let bundle = ""
let hostServer: Server | undefined
let childServer: Server | undefined
let hostUrl = ""
let childUrl = ""

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected the test HTTP server to listen on a TCP port")
  }
  return `http://127.0.0.1:${address.port}`
}

function childHtml(): string {
  return `<!doctype html>
    <html><body><output id="result">waiting</output><script>
      const announceReady = () => parent.postMessage("ready", "*")
      const readyTimer = setInterval(announceReady, 50)
      announceReady()
      addEventListener("message", (event) => {
        if (event.data !== "communication-port" || event.ports.length !== 1) return
        clearInterval(readyTimer)
        const port = event.ports[0]
        port.addEventListener("message", ({ data }) => {
          if (data?.message !== "upload-result") return
          const uploadedFile = Array.isArray(data.files) ? data.files[0] : null
          document.querySelector("#result").textContent = JSON.stringify({
            requestId: data.requestId,
            success: data.success,
            id: uploadedFile?.id ?? null,
            url: uploadedFile?.url ?? null,
          })
        })
        port.start()
        const file = new File([new Uint8Array([0, 1, 2, 3, 255, 128, 64])], "sample.bin", {
          type: "application/octet-stream",
          lastModified: 1725000000000,
        })
        port.postMessage({
          message: "file-upload",
          requestId: "browser-request-1",
          files: [file],
        })
      })
    </script></body></html>`
}

async function buildBrowserHarness(): Promise<string> {
  const virtualId = "virtual:message-channel-host-test"
  const resolvedVirtualId = `\0${virtualId}`
  const source = `
    import React from "react"
    import { createRoot } from "react-dom/client"
    import i18next from "i18next"
    import { I18nextProvider, initReactI18next } from "react-i18next"
    import MessageChannelIFrame from ${JSON.stringify(componentPath)}

    const i18n = i18next.createInstance()
    void i18n.use(initReactI18next).init({
      lng: "en",
      fallbackLng: "en",
      initImmediate: false,
      resources: { en: { translation: {} } },
    })

    globalThis.mountMessageChannelHost = (url) => {
      globalThis.transportSnapshot = null
      const onMessageFromIframe = (message, responsePort) => {
        if (message.message !== "file-upload") return
        void (async () => {
          const value = Array.isArray(message.files) ? message.files[0] : null
          const bytes = value instanceof Blob
            ? [...new Uint8Array(await value.arrayBuffer())]
            : null
          const digest = value instanceof Blob
            ? [...new Uint8Array(await crypto.subtle.digest("SHA-256", await value.arrayBuffer()))]
                .map((byte) => byte.toString(16).padStart(2, "0"))
                .join("")
            : null
          globalThis.transportSnapshot = {
            requestId: message.requestId ?? null,
            filesAreArray: Array.isArray(message.files),
            valueIsFile: value instanceof File,
            name: value instanceof File ? value.name : null,
            type: value instanceof Blob ? value.type : null,
            size: value instanceof Blob ? value.size : null,
            lastModified: value instanceof File ? value.lastModified : null,
            bytes,
            sha256: digest,
          }
          responsePort.postMessage({
            message: "upload-result",
            requestId: message.requestId,
            success: true,
            files: [{ id: "host-file-1", url: "https://files.example/sample.bin" }],
          })
        })()
      }
      const dialog = {
        alert: async () => {},
        confirm: async () => true,
      }
      createRoot(document.querySelector("#root")).render(
        React.createElement(
          I18nextProvider,
          { i18n },
          React.createElement(MessageChannelIFrame, {
            url,
            title: "Cross-origin exercise",
            postThisStateToIFrame: null,
            onMessageFromIframe,
            dialog,
          }),
        ),
      )
    }
  `
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [
      react(),
      {
        name: "virtual-message-channel-host-test",
        resolveId(id) {
          return id === virtualId ? resolvedVirtualId : null
        },
        load(id) {
          return id === resolvedVirtualId ? source : null
        },
      },
    ],
    build: {
      write: false,
      target: "es2022",
      rollupOptions: {
        input: virtualId,
        output: { format: "iife", name: "MessageChannelHostTest" },
      },
    },
  })
  const output = Array.isArray(result) ? result.flatMap((entry) => entry.output) : result.output
  const chunk = output.find((entry) => entry.type === "chunk")
  if (chunk?.type !== "chunk") {
    throw new Error("Vite did not produce the browser test harness chunk")
  }
  return chunk.code
}

test.beforeAll(async () => {
  bundle = await buildBrowserHarness()
  hostServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    response.end('<!doctype html><html><body><div id="root"></div></body></html>')
  })
  childServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    response.end(childHtml())
  })
  ;[hostUrl, childUrl] = await Promise.all([listen(hostServer), listen(childServer)])
})

test.afterAll(async () => {
  const servers = [hostServer, childServer].filter(
    (server): server is Server => server !== undefined,
  )
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()))
        }),
    ),
  )
})

test("MessageChannelIFrame preserves File bytes across a sandboxed cross-origin transport", async ({
  page,
}) => {
  await page.goto(hostUrl)
  await page.addScriptTag({ content: bundle })
  await page.evaluate((url) => {
    ;(
      globalThis as typeof globalThis & { mountMessageChannelHost: (iframeUrl: string) => void }
    ).mountMessageChannelHost(url)
  }, childUrl)

  const iframe = page.getByTitle("Cross-origin exercise")
  await expect(iframe).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-forms allow-downloads allow-same-origin",
  )
  await expect(iframe.contentFrame().locator("#result")).toContainText(
    "https://files.example/sample.bin",
  )

  const snapshot = await page.waitForFunction(() => {
    return (globalThis as typeof globalThis & { transportSnapshot?: unknown }).transportSnapshot
  })
  expect(await snapshot.jsonValue()).toEqual({
    requestId: "browser-request-1",
    filesAreArray: true,
    valueIsFile: true,
    name: "sample.bin",
    type: "application/octet-stream",
    size: fileBytes.byteLength,
    lastModified: 1_725_000_000_000,
    bytes: [...fileBytes],
    sha256: expectedDigest,
  })

  const childResult = JSON.parse(
    (await iframe.contentFrame().locator("#result").textContent()) ?? "null",
  )
  expect(childResult).toEqual({
    requestId: "browser-request-1",
    success: true,
    id: "host-file-1",
    url: "https://files.example/sample.bin",
  })
  expect(new URL(hostUrl).origin).not.toBe(new URL(childUrl).origin)
})
