"use client"

import { act, renderHook } from "@testing-library/react"

import type { FileUploadMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import useFileUpload from "../../src/react/hooks/useFileUpload"

function createFakePort() {
  const listeners = new Set<(event: MessageEvent) => void>()
  const posted: unknown[] = []
  const port = {
    postMessage: jest.fn((message: unknown) => {
      posted.push(message)
    }),
    addEventListener: jest.fn((_type: "message", listener: (event: MessageEvent) => void) => {
      listeners.add(listener)
    }),
    removeEventListener: jest.fn((_type: "message", listener: (event: MessageEvent) => void) => {
      listeners.delete(listener)
    }),
  } as unknown as MessagePort

  return {
    port,
    posted,
    listenerCount: () => listeners.size,
    reply: (data: unknown) => {
      act(() => {
        for (const listener of listeners) {
          listener({ data } as MessageEvent)
        }
      })
    },
  }
}

describe("useFileUpload", () => {
  it("rejects while no parent port is connected", async () => {
    const { result } = renderHook(() => useFileUpload(null))

    await expect(result.current(new Map())).rejects.toThrow(
      "Not connected to the parent window yet",
    )
  })

  it("keeps a stable callback and sends the original Map and File over the connected port", async () => {
    const fake = createFakePort()
    const { result, rerender } = renderHook(({ port }) => useFileUpload(port), {
      initialProps: { port: fake.port as MessagePort | null },
    })
    const upload = result.current
    const file = new File(["exact bytes"], "answer.txt", {
      type: "text/plain",
      lastModified: 1_725_000_000_000,
    })
    const files = new Map<string, string | Blob>([["answer.txt", file]])

    const pending = upload(files)
    rerender({ port: fake.port })

    expect(result.current).toBe(upload)
    expect(fake.posted).toHaveLength(1)
    const message = fake.posted[0] as FileUploadMessage
    expect(message).toEqual({ message: "file-upload", requestId: "file-upload-1", files })
    expect(message.files).toBe(files)
    expect(message.files.get("answer.txt")).toBe(file)
    fake.reply({
      message: "upload-result",
      requestId: message.requestId,
      success: true,
      urls: new Map(),
    })
    await expect(pending).resolves.toEqual(new Map())
  })

  it("resolves and rejects according to correlated parent responses", async () => {
    const fake = createFakePort()
    const { result } = renderHook(() => useFileUpload(fake.port))
    const success = result.current(new Map([["ok.txt", "ok"]]))
    const failure = result.current(new Map([["bad.txt", "bad"]]))
    const successMessage = fake.posted[0] as FileUploadMessage
    const failureMessage = fake.posted[1] as FileUploadMessage
    const urls = new Map([["ok.txt", "https://files.example/ok"]])

    fake.reply({
      message: "upload-result",
      requestId: failureMessage.requestId,
      success: false,
      error: "rejected by host",
    })
    fake.reply({
      message: "upload-result",
      requestId: successMessage.requestId,
      success: true,
      urls,
    })

    await expect(success).resolves.toBe(urls)
    await expect(failure).rejects.toThrow("rejected by host")
  })

  it("disposes the old client when the port changes and routes new uploads to the new port", async () => {
    const first = createFakePort()
    const second = createFakePort()
    const { result, rerender } = renderHook(({ port }) => useFileUpload(port), {
      initialProps: { port: first.port as MessagePort | null },
    })
    const pending = result.current(new Map([["old.txt", "old"]]))
    const pendingAssertion = expect(pending).rejects.toThrow(
      "Upload client was disposed before the upload completed",
    )

    rerender({ port: second.port })

    await pendingAssertion
    expect(first.listenerCount()).toBe(0)
    expect(second.listenerCount()).toBe(1)

    const next = result.current(new Map([["new.txt", "new"]]))
    const nextMessage = second.posted[0] as FileUploadMessage
    const urls = new Map([["new.txt", "https://files.example/new"]])
    second.reply({
      message: "upload-result",
      requestId: nextMessage.requestId,
      success: true,
      urls,
    })
    await expect(next).resolves.toBe(urls)
    expect(first.posted).toHaveLength(1)
  })

  it("disposes pending uploads and removes its listener on unmount", async () => {
    const fake = createFakePort()
    const { result, unmount } = renderHook(() => useFileUpload(fake.port))
    const pending = result.current(new Map([["answer.txt", "answer"]]))
    const assertion = expect(pending).rejects.toThrow(
      "Upload client was disposed before the upload completed",
    )

    unmount()

    await assertion
    expect(fake.listenerCount()).toBe(0)
    expect(fake.port.removeEventListener).toHaveBeenCalledTimes(1)
  })
})
