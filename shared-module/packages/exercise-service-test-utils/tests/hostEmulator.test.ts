// Exercises the injectable emulator itself, driven through a mock MessageChannel (no browser). The
// emulator source is loaded from HOST_EMULATOR_SOURCE via `new Function`, so this tests the exact
// bytes that get injected. The mock channel wires port1 <-> port2 synchronously, and the "iframe"
// side holds port2 (post to send TO the emulator; set onmessage to capture what it sends back).

import type { HostApi, RecordedMessage } from "../src/browser/hostEmulator.types"
import { HOST_EMULATOR_SOURCE } from "../src/browser/hostEmulatorSource"

interface MockPort {
  onmessage: ((event: { data: unknown }) => void) | null
  postMessage: (data: unknown) => void
}

function createMockChannel(): { port1: MockPort; port2: MockPort } {
  const port1: MockPort = {
    onmessage: null,
    postMessage: (data) => port2.onmessage?.({ data }),
  }
  const port2: MockPort = {
    onmessage: null,
    postMessage: (data) => port1.onmessage?.({ data }),
  }
  return { port1, port2 }
}

interface Installed {
  host: HostApi
  iframePort: MockPort
  received: RecordedMessage[]
}

/** Sends a message to the emulator through the mock iframe port. */
function postToEmulator(port: MockPort, message: unknown): void {
  // oxlint-disable-next-line require-post-message-target-origin -- MockPort emulates a MessagePort, not window; there is no targetOrigin
  port.postMessage(message)
}

function installEmulator(options: Record<string, unknown> = {}): Installed {
  const channel = createMockChannel()
  const makeEmulator = new Function(`return (${HOST_EMULATOR_SOURCE})`)() as (o: unknown) => string
  makeEmulator({ ...options, createChannel: () => channel, transferPort: () => undefined })
  const host = (window as unknown as { __host: HostApi }).__host
  const received: RecordedMessage[] = []
  // oxlint-disable-next-line prefer-add-event-listener -- MockPort only models the `onmessage` setter, not addEventListener
  channel.port2.onmessage = (event) => received.push(event.data as RecordedMessage)
  return { host, iframePort: channel.port2, received }
}

function findMessage(list: RecordedMessage[], type: string): RecordedMessage | undefined {
  return list.find((message) => message.message === type)
}

describe("host emulator", () => {
  test("auto-answers file-upload with ordered host ids and URLs echoing requestId", () => {
    const { host, iframePort, received } = installEmulator()
    const files = [new File(["content"], "essay.txt", { type: "text/plain" })]
    postToEmulator(iframePort, { message: "file-upload", requestId: "r1", files })

    const result = findMessage(received, "upload-result")
    expect(result?.success).toBe(true)
    expect(result?.requestId).toBe("r1")
    expect(result?.files).toEqual([
      expect.objectContaining({ id: expect.any(String), url: "https://uploads.example/essay.txt" }),
    ])
    expect(host.last("file-upload")).toMatchObject({ message: "file-upload", requestId: "r1" })
  })

  test("auto-answers tolerated non-array file containers without relying on randomUUID", () => {
    const { iframePort, received } = installEmulator()
    postToEmulator(iframePort, {
      message: "file-upload",
      requestId: "legacy-map",
      files: new Map([["legacy-name", "not-a-file"]]),
    })

    expect(findMessage(received, "upload-result")).toMatchObject({
      message: "upload-result",
      requestId: "legacy-map",
      success: true,
      files: [
        {
          id: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          ),
          url: "https://uploads.example/legacy-name",
        },
      ],
    })
  })

  test("auto-confirms open-dialog echoing requestId", () => {
    const { iframePort, received } = installEmulator()
    postToEmulator(iframePort, {
      message: "open-dialog",
      requestId: "d1",
      dialogType: "confirm",
      title: "T",
      body: ["b"],
    })
    expect(findMessage(received, "dialog-response")).toMatchObject({
      message: "dialog-response",
      requestId: "d1",
      confirmed: true,
    })
  })

  test("records history; last() survives height-changed spam; waitFor resolves", async () => {
    const { host, iframePort } = installEmulator()
    postToEmulator(iframePort, { message: "height-changed", data: 100 })
    postToEmulator(iframePort, {
      message: "current-state",
      data: { selectedOptionId: "x" },
      valid: true,
    })
    postToEmulator(iframePort, { message: "height-changed", data: 120 })

    expect(host.last("current-state")).toMatchObject({ data: { selectedOptionId: "x" } })
    expect(host.messages("height-changed")).toHaveLength(2)
    await expect(host.waitFor("current-state")).resolves.toMatchObject({
      data: { selectedOptionId: "x" },
    })
  })

  test("setState posts a full set-state envelope to the iframe", () => {
    const { host, received } = installEmulator()
    host.setState("answer-exercise", { public_spec: [], previous_submission: null })
    expect(findMessage(received, "set-state")).toMatchObject({
      message: "set-state",
      view_type: "answer-exercise",
      exercise_task_id: "00000000-0000-0000-0000-000000000000",
      user_information: { pseudonymous_id: "test-user", signed_in: false },
    })
  })

  test("autoUpload:false suppresses auto-answer; sendUploadResult drives success and error", () => {
    const { host, iframePort, received } = installEmulator({ autoUpload: false })
    postToEmulator(iframePort, {
      message: "file-upload",
      requestId: "r2",
      files: [new File(["x"], "a.txt", { type: "text/plain" })],
    })
    expect(findMessage(received, "upload-result")).toBeUndefined()

    host.sendUploadResult("r2", { files: [{ id: "host-a", url: "https://cdn/x" }] })
    const ok = findMessage(received, "upload-result")
    expect(ok).toMatchObject({ requestId: "r2", success: true })
    expect(ok?.files).toEqual([{ id: "host-a", url: "https://cdn/x" }])

    host.sendUploadResult("r2", { error: "boom" })
    const uploadResults = received.filter((message) => message.message === "upload-result")
    expect(uploadResults[uploadResults.length - 1]).toMatchObject({
      success: false,
      error: "boom",
    })
  })

  test("snapshots File arrays with exact browser-realm metadata and SHA-256", async () => {
    const { host, iframePort } = installEmulator({ autoUpload: false })
    const snapshotPromise = host.waitForFileUpload((upload) => upload.requestId === "bytes-1")
    const files = [
      new File(["hello"], "answer.txt", { type: "text/plain", lastModified: 123 }),
      new File([new Uint8Array([0, 1, 2, 255])], "raw.bin", {
        type: "application/octet-stream",
        lastModified: 124,
      }),
    ]

    postToEmulator(iframePort, { message: "file-upload", requestId: "bytes-1", files })

    expect(host.fileUploadCount()).toBe(1)
    await expect(snapshotPromise).resolves.toEqual({
      requestId: "bytes-1",
      filesKind: "array",
      entries: [
        {
          key: "0",
          kind: "file",
          name: "answer.txt",
          type: "text/plain",
          size: 5,
          lastModified: 123,
          sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        },
        {
          key: "1",
          kind: "file",
          name: "raw.bin",
          type: "application/octet-stream",
          size: 4,
          lastModified: 124,
          sha256: "3d1f57c984978ef98a18378c8166c1cb8ede02c03eeb6aee7e2f121dfeee3e56",
        },
      ],
    })
  })

  test("classifies non-Map containers and reset clears upload snapshots", async () => {
    const { host, iframePort } = installEmulator({ autoUpload: false })
    postToEmulator(iframePort, {
      message: "file-upload",
      requestId: "object",
      files: { answer: "value" },
    })
    postToEmulator(iframePort, { message: "file-upload", requestId: "array", files: ["value"] })
    postToEmulator(iframePort, { message: "file-upload", requestId: "missing" })
    postToEmulator(iframePort, { message: "file-upload", requestId: 12, files: null })

    await host.waitForFileUpload((upload) => upload.requestId === "missing")
    await host.waitForFileUpload((upload) => upload.filesKind === "other")
    expect(host.fileUploads()).toEqual([
      {
        requestId: "object",
        filesKind: "plain-object",
        entries: [
          {
            key: "answer",
            kind: "string",
            name: null,
            type: null,
            size: 5,
            lastModified: null,
            sha256: "cd42404d52ad55ccfa9aca4adc828aa5800ad9d385a0671fbcbf724118320619",
          },
        ],
      },
      {
        requestId: "array",
        filesKind: "array",
        entries: [
          {
            key: "0",
            kind: "string",
            name: null,
            type: null,
            size: 5,
            lastModified: null,
            sha256: "cd42404d52ad55ccfa9aca4adc828aa5800ad9d385a0671fbcbf724118320619",
          },
        ],
      },
      { requestId: "missing", filesKind: "missing", entries: [] },
      { requestId: null, filesKind: "other", entries: [] },
    ])

    host.reset()
    expect(host.fileUploadCount()).toBe(0)
    expect(host.fileUploads()).toEqual([])
    expect(host.messages()).toEqual([])
  })
})
