"use client"

import { act, renderHook } from "@testing-library/react"

import type { FileUploadMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import useFileUpload from "../../src/react/hooks/useFileUpload"

function createFakePort() {
  const listeners = new Set<(event: MessageEvent) => void>()
  const posted: unknown[] = []
  const port = {
    postMessage: jest.fn((message: unknown) => posted.push(message)),
    addEventListener: jest.fn((_type: "message", listener: (event: MessageEvent) => void) =>
      listeners.add(listener),
    ),
    removeEventListener: jest.fn((_type: "message", listener: (event: MessageEvent) => void) =>
      listeners.delete(listener),
    ),
  } as unknown as MessagePort
  return {
    port,
    posted,
    listenerCount: () => listeners.size,
    reply: (data: unknown) =>
      act(() => listeners.forEach((listener) => listener({ data } as MessageEvent))),
  }
}

describe("useFileUpload", () => {
  it("rejects until connected", async () => {
    const { result } = renderHook(() => useFileUpload(null))
    await expect(result.current([])).rejects.toThrow("Not connected to the parent window yet")
  })

  it("sends File arrays and exposes host file ids plus request ids", async () => {
    const fake = createFakePort()
    const { result } = renderHook(() => useFileUpload(fake.port))
    const file = new File(["exact bytes"], "answer.txt", { type: "text/plain" })
    const pending = result.current([file])
    const message = fake.posted[0] as FileUploadMessage
    expect(message).toEqual({ message: "file-upload", requestId: "file-upload-1", files: [file] })
    fake.reply({
      message: "upload-result",
      requestId: message.requestId,
      success: true,
      files: [{ id: "host-id", url: "https://files.example/answer" }],
    })
    await expect(pending).resolves.toEqual([
      { requestId: message.requestId, id: "host-id", file, url: "https://files.example/answer" },
    ])
  })

  it("disposes its client when unmounted", async () => {
    const fake = createFakePort()
    const { result, unmount } = renderHook(() => useFileUpload(fake.port))
    const pending = result.current([new File(["x"], "answer.txt")])
    unmount()
    await expect(pending).rejects.toThrow("Upload client was disposed before the upload completed")
    expect(fake.listenerCount()).toBe(0)
  })
})
