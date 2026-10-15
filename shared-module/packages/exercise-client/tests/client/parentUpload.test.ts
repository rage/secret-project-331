import type { FileUploadMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import {
  FileUploadError,
  ParentUploadClient,
  type UploadCapableMessagePort,
} from "../../src/client/parentUpload"

function createFakePort() {
  const listeners = new Set<(event: MessageEvent) => void>()
  const posted: unknown[] = []
  const port: UploadCapableMessagePort = {
    postMessage: (message) => posted.push(message),
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  }
  return {
    port,
    posted,
    listenerCount: () => listeners.size,
    reply: (data: unknown) => listeners.forEach((listener) => listener({ data } as MessageEvent)),
  }
}

const file = (name: string) => new File([name], name, { type: "text/plain" })
const uploadAt = (posted: unknown[], index = 0) => posted[index] as FileUploadMessage

describe("ParentUploadClient", () => {
  afterEach(() => jest.useRealTimers())

  it("sends only ordered Files and pairs host results with their request id", async () => {
    const fake = createFakePort()
    const client = new ParentUploadClient(fake.port)
    const files = [file("same.txt"), file("same.txt")]
    const pending = client.uploadFiles(files)
    const message = uploadAt(fake.posted)

    expect(message).toEqual({ message: "file-upload", requestId: "file-upload-1", files })
    fake.reply({
      message: "upload-result",
      requestId: message.requestId,
      success: true,
      files: [
        { id: "aaaaaaa1-0000-4000-8000-000000000000", url: "https://files.example/one" },
        { id: "aaaaaaa2-0000-4000-8000-000000000000", url: "https://files.example/two" },
      ],
    })

    await expect(pending).resolves.toEqual([
      {
        requestId: "file-upload-1",
        id: "aaaaaaa1-0000-4000-8000-000000000000",
        file: files[0],
        url: "https://files.example/one",
      },
      {
        requestId: "file-upload-1",
        id: "aaaaaaa2-0000-4000-8000-000000000000",
        file: files[1],
        url: "https://files.example/two",
      },
    ])
  })

  it("rejects host errors, malformed results, and timeouts", async () => {
    jest.useFakeTimers()
    const fake = createFakePort()
    const client = new ParentUploadClient(fake.port, { timeoutMs: 10 })
    const rejected = client.uploadFiles([file("error.txt")])
    const rejectedId = uploadAt(fake.posted).requestId
    fake.reply({
      message: "upload-result",
      requestId: rejectedId,
      success: false,
      error: "quota exceeded",
    })
    await expect(rejected).rejects.toEqual(new FileUploadError("quota exceeded"))

    const wrongCount = client.uploadFiles([file("first.txt"), file("second.txt")])
    const wrongCountId = uploadAt(fake.posted, 1).requestId
    fake.reply({ message: "upload-result", requestId: wrongCountId, success: true, files: [] })
    await expect(wrongCount).rejects.toBeInstanceOf(FileUploadError)

    const malformed = client.uploadFiles([file("malformed.txt")])
    const malformedId = uploadAt(fake.posted, 2).requestId
    fake.reply({
      message: "upload-result",
      requestId: malformedId,
      success: true,
      files: [{ id: "host-file", url: 42 }],
    })
    await expect(malformed).rejects.toEqual(
      new FileUploadError("The parent returned an invalid upload result"),
    )

    const timeout = client.uploadFiles([file("timeout.txt")])
    jest.advanceTimersByTime(10)
    await expect(timeout).rejects.toBeInstanceOf(FileUploadError)
  })

  it("correlates concurrent replies and disposal", async () => {
    const fake = createFakePort()
    const client = new ParentUploadClient(fake.port)
    const first = client.uploadFiles([file("first.txt")])
    const second = client.uploadFiles([file("second.txt")])
    const firstMessage = uploadAt(fake.posted)
    const secondMessage = uploadAt(fake.posted, 1)
    fake.reply({
      message: "upload-result",
      requestId: secondMessage.requestId,
      success: true,
      files: [{ id: "2", url: "https://files.example/two" }],
    })
    fake.reply({
      message: "upload-result",
      requestId: firstMessage.requestId,
      success: true,
      files: [{ id: "1", url: "https://files.example/one" }],
    })
    await expect(first).resolves.toMatchObject([{ id: "1" }])
    await expect(second).resolves.toMatchObject([{ id: "2" }])

    const pending = client.uploadFiles([file("pending.txt")])
    client.dispose()
    expect(fake.listenerCount()).toBe(0)
    await expect(pending).rejects.toBeInstanceOf(FileUploadError)
    await expect(client.uploadFiles([])).rejects.toBeInstanceOf(FileUploadError)
  })
})
