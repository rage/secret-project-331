import { expect, test as base } from "@playwright/test"

import { withBrowserDiagnostics } from "../../../exercise-service-test-utils/playwright/fixtures/diagnostics"
import {
  isFileUploadMessage,
  isMessageFromIframe,
  isMessageToIframe,
  isUploadResultMessage,
} from "../../src/core/exercise-service-protocol-types.guard"

const test = withBrowserDiagnostics(base)

test("file-upload guards accept a genuine Map and File and reject plain objects", async ({
  page,
}) => {
  const file = new File([new Uint8Array([0, 1, 2, 255])], "sample.bin", {
    type: "application/octet-stream",
    lastModified: 1_725_000_000_000,
  })
  const message = {
    message: "file-upload",
    requestId: "request-1",
    files: new Map<string, string | Blob>([["sample.bin", file]]),
  }

  expect(isFileUploadMessage(message)).toBe(true)
  expect(isMessageFromIframe(message)).toBe(true)
  expect(
    isFileUploadMessage({
      ...message,
      files: { "sample.bin": file },
    }),
  ).toBe(false)

  const cloned = await page.evaluate(async () => {
    const channel = new MessageChannel()
    const received = new Promise<unknown>((resolve) => {
      channel.port2.addEventListener("message", ({ data }) => resolve(data), { once: true })
      channel.port2.start()
    })
    const sourceFile = new File([new Uint8Array([0, 1, 2, 255])], "sample.bin", {
      type: "application/octet-stream",
      lastModified: 1_725_000_000_000,
    })
    channel.port1.postMessage(new Map([["sample.bin", sourceFile]]))
    const data = await received
    if (!(data instanceof Map)) {
      return { isMap: false }
    }
    const receivedFile = data.get("sample.bin")
    if (!(receivedFile instanceof File)) {
      return { isMap: true, isFile: false }
    }
    return {
      isMap: true,
      isFile: true,
      name: receivedFile.name,
      type: receivedFile.type,
      size: receivedFile.size,
      lastModified: receivedFile.lastModified,
      bytes: [...new Uint8Array(await receivedFile.arrayBuffer())],
    }
  })

  expect(cloned).toEqual({
    isMap: true,
    isFile: true,
    name: "sample.bin",
    type: "application/octet-stream",
    size: 4,
    lastModified: 1_725_000_000_000,
    bytes: [0, 1, 2, 255],
  })
})

test("upload-result guards require URL Maps on success but accept correlated errors", () => {
  const success = {
    message: "upload-result",
    requestId: "request-1",
    success: true,
    urls: new Map([["sample.bin", "https://files.example/sample.bin"]]),
  }
  const failure = {
    message: "upload-result",
    requestId: "request-2",
    success: false,
    error: "upload rejected",
  }

  expect(isUploadResultMessage(success)).toBe(true)
  expect(isMessageToIframe(success)).toBe(true)
  expect(isUploadResultMessage(failure)).toBe(true)
  expect(isMessageToIframe(failure)).toBe(true)
  expect(
    isUploadResultMessage({
      ...success,
      urls: { "sample.bin": "https://files.example/sample.bin" },
    }),
  ).toBe(false)
  expect(isUploadResultMessage({ ...failure, requestId: 12 })).toBe(false)
  expect(isUploadResultMessage({ ...failure, error: null })).toBe(false)
})
