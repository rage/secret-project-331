import type {
  FileUploadMessage,
  UploadResultMessage,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import {
  FileUploadError,
  ParentUploadClient,
  type UploadCapableMessagePort,
} from "../../src/client/parentUpload"

function createFakePort() {
  const listeners = new Set<(event: MessageEvent) => void>()
  const posted: unknown[] = []
  const port: UploadCapableMessagePort = {
    postMessage: (message) => {
      posted.push(message)
    },
    addEventListener: (_type, listener) => {
      listeners.add(listener)
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener)
    },
  }

  return {
    port,
    posted,
    listenerCount: () => listeners.size,
    reply: (data: unknown) => {
      for (const listener of listeners) {
        listener({ data } as MessageEvent)
      }
    },
  }
}

const uploadMessageAt = (posted: unknown[], index = 0): FileUploadMessage =>
  posted[index] as FileUploadMessage

describe("ParentUploadClient", () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it("posts the exact file-upload payload without converting its Map or File", async () => {
    const fake = createFakePort()
    const client = new ParentUploadClient(fake.port)
    const file = new File([new Uint8Array([0, 1, 2, 255])], "sample.bin", {
      type: "application/octet-stream",
      lastModified: 1_725_000_000_000,
    })
    const files = new Map<string, string | Blob>([
      ["sample.bin", file],
      ["note", "plain text"],
    ])

    const pending = client.uploadFiles(files)

    expect(fake.posted).toEqual([
      {
        message: "file-upload",
        requestId: "file-upload-1",
        files,
      },
    ])
    const postedFiles = uploadMessageAt(fake.posted).files
    expect(postedFiles).toBe(files)
    expect(postedFiles).toBeInstanceOf(Map)
    expect(postedFiles.get("sample.bin")).toBe(file)
    const { requestId } = uploadMessageAt(fake.posted)
    fake.reply({ message: "upload-result", requestId, success: true, urls: new Map() })
    await expect(pending).resolves.toEqual(new Map())
    client.dispose()
  })

  it("resolves with the matching success Map", async () => {
    const fake = createFakePort()
    const client = new ParentUploadClient(fake.port)
    const pending = client.uploadFiles(new Map([["answer.txt", new Blob(["answer"])]]))
    const { requestId } = uploadMessageAt(fake.posted)
    const urls = new Map([["answer.txt", "https://files.example/answer.txt"]])

    fake.reply({ message: "upload-result", requestId, success: true, urls })

    await expect(pending).resolves.toBe(urls)
    client.dispose()
  })

  it("rejects with the host's error", async () => {
    const fake = createFakePort()
    const client = new ParentUploadClient(fake.port)
    const pending = client.uploadFiles(new Map([["answer.txt", "answer"]]))
    const { requestId } = uploadMessageAt(fake.posted)

    fake.reply({ message: "upload-result", requestId, success: false, error: "quota exceeded" })

    await expect(pending).rejects.toEqual(new FileUploadError("quota exceeded"))
    client.dispose()
  })

  it("times out when the parent does not answer", async () => {
    jest.useFakeTimers()
    const fake = createFakePort()
    const client = new ParentUploadClient(fake.port, { timeoutMs: 250 })
    const pending = client.uploadFiles(new Map([["answer.txt", "answer"]]))
    const assertion = expect(pending).rejects.toEqual(
      new FileUploadError("The parent window did not respond to the file upload within 250ms"),
    )

    jest.advanceTimersByTime(249)
    await Promise.resolve()
    jest.advanceTimersByTime(1)

    await assertion
    client.dispose()
  })

  it("ignores unknown IDs and settles only from the matching response", async () => {
    const fake = createFakePort()
    const client = new ParentUploadClient(fake.port)
    const pending = client.uploadFiles(new Map([["answer.txt", "answer"]]))
    const { requestId } = uploadMessageAt(fake.posted)
    const expected = new Map([["answer.txt", "https://files.example/right"]])
    let settled = false
    void pending.finally(() => {
      settled = true
    })

    fake.reply({
      message: "upload-result",
      requestId: "file-upload-unknown",
      success: true,
      urls: new Map([["answer.txt", "https://files.example/wrong"]]),
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    fake.reply({ message: "upload-result", requestId, success: true, urls: expected })
    await expect(pending).resolves.toBe(expected)
    client.dispose()
  })

  it.each([undefined, null])(
    "accepts a legacy response with requestId %s when exactly one upload is pending",
    async (requestId) => {
      const fake = createFakePort()
      const client = new ParentUploadClient(fake.port)
      const pending = client.uploadFiles(new Map([["answer.txt", "answer"]]))
      const urls = new Map([["answer.txt", "https://files.example/legacy"]])
      const response: UploadResultMessage = {
        message: "upload-result",
        ...(requestId === undefined ? {} : { requestId }),
        success: true,
        urls,
      }

      fake.reply(response)

      await expect(pending).resolves.toBe(urls)
      client.dispose()
    },
  )

  it("does not guess which concurrent upload an uncorrelated response belongs to", async () => {
    jest.useFakeTimers()
    const fake = createFakePort()
    const client = new ParentUploadClient(fake.port, { timeoutMs: 50 })
    const first = client.uploadFiles(new Map([["first.txt", "first"]]))
    const second = client.uploadFiles(new Map([["second.txt", "second"]]))
    const firstAssertion = expect(first).rejects.toBeInstanceOf(FileUploadError)
    const secondAssertion = expect(second).rejects.toBeInstanceOf(FileUploadError)

    fake.reply({
      message: "upload-result",
      success: true,
      urls: new Map([["unknown.txt", "https://files.example/unknown"]]),
    })
    jest.advanceTimersByTime(50)

    await Promise.all([firstAssertion, secondAssertion])
    client.dispose()
  })

  it("correlates concurrent responses by requestId even when they arrive out of order", async () => {
    const fake = createFakePort()
    const client = new ParentUploadClient(fake.port)
    const first = client.uploadFiles(new Map([["first.txt", "first"]]))
    const second = client.uploadFiles(new Map([["second.txt", "second"]]))
    const firstId = uploadMessageAt(fake.posted, 0).requestId
    const secondId = uploadMessageAt(fake.posted, 1).requestId
    const firstUrls = new Map([["first.txt", "https://files.example/first"]])
    const secondUrls = new Map([["second.txt", "https://files.example/second"]])

    expect(firstId).toBe("file-upload-1")
    expect(secondId).toBe("file-upload-2")
    fake.reply({ message: "upload-result", requestId: secondId, success: true, urls: secondUrls })
    fake.reply({ message: "upload-result", requestId: firstId, success: true, urls: firstUrls })

    await expect(first).resolves.toBe(firstUrls)
    await expect(second).resolves.toBe(secondUrls)
    client.dispose()
  })

  it("disposal detaches the listener, rejects pending work, and rejects future calls", async () => {
    const fake = createFakePort()
    const client = new ParentUploadClient(fake.port)
    const pending = client.uploadFiles(new Map([["answer.txt", "answer"]]))
    const pendingAssertion = expect(pending).rejects.toEqual(
      new FileUploadError("Upload client was disposed before the upload completed"),
    )

    expect(fake.listenerCount()).toBe(1)
    client.dispose()

    expect(fake.listenerCount()).toBe(0)
    await pendingAssertion
    const postedCount = fake.posted.length
    await expect(client.uploadFiles(new Map())).rejects.toEqual(
      new FileUploadError("Upload client has been disposed"),
    )
    expect(fake.posted).toHaveLength(postedCount)

    expect(() => client.dispose()).not.toThrow()
  })

  it("ignores malformed messages, including plain-object URL collections", async () => {
    jest.useFakeTimers()
    const fake = createFakePort()
    const client = new ParentUploadClient(fake.port, { timeoutMs: 10 })
    const pending = client.uploadFiles(new Map([["answer.txt", "answer"]]))
    const { requestId } = uploadMessageAt(fake.posted)
    const assertion = expect(pending).rejects.toBeInstanceOf(FileUploadError)

    fake.reply({
      message: "upload-result",
      requestId,
      success: true,
      urls: { "answer.txt": "https://files.example/not-a-map" },
    })
    fake.reply({ message: "something-else" })
    fake.reply(null)
    jest.advanceTimersByTime(10)

    await assertion
    client.dispose()
  })
})
