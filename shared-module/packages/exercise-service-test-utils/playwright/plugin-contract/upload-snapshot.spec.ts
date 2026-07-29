import { Buffer } from "node:buffer"

import { expect, test as base } from "@playwright/test"

import { createHostEmulator } from "../../src/playwright/createHostEmulator"
import { withBrowserDiagnostics } from "../fixtures/diagnostics"

const test = withBrowserDiagnostics(base)

test("captures exact File bytes before Playwright serialization", async ({ page }) => {
  await page.setContent('<input id="upload" type="file">')
  await page.evaluate(() => {
    let port: MessagePort | null = null
    window.addEventListener("message", (event) => {
      if (event.data !== "communication-port" || !event.ports[0]) {
        return
      }
      port = event.ports[0]
      port.start()
    })
    document.querySelector<HTMLInputElement>("#upload")?.addEventListener("change", (event) => {
      const files = new Map<string, File>()
      for (const file of (event.currentTarget as HTMLInputElement).files ?? []) {
        files.set(file.name, file)
      }
      port?.postMessage({ message: "file-upload", requestId: "contract-upload", files })
    })
  })

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
    filesKind: "map",
    entries: [
      {
        key: "answer.txt",
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
