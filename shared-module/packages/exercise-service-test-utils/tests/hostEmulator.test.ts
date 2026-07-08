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

function installEmulator(options: Record<string, unknown> = {}): Installed {
  const channel = createMockChannel()
  const makeEmulator = new Function(`return (${HOST_EMULATOR_SOURCE})`)() as (o: unknown) => string
  makeEmulator({ ...options, createChannel: () => channel, transferPort: () => undefined })
  const host = (window as unknown as { __host: HostApi }).__host
  const received: RecordedMessage[] = []
  channel.port2.onmessage = (event) => received.push(event.data as RecordedMessage)
  return { host, iframePort: channel.port2, received }
}

function findMessage(list: RecordedMessage[], type: string): RecordedMessage | undefined {
  return list.find((message) => message.message === type)
}

describe("host emulator", () => {
  test("auto-answers file-upload with a Map of fake URLs echoing requestId", () => {
    const { host, iframePort, received } = installEmulator()
    const files = new Map<string, string>([["essay.txt", "content"]])
    iframePort.postMessage({ message: "file-upload", requestId: "r1", files })

    const result = findMessage(received, "upload-result")
    expect(result?.success).toBe(true)
    expect(result?.requestId).toBe("r1")
    expect(result?.urls instanceof Map).toBe(true)
    expect((result?.urls as Map<string, string>).get("essay.txt")).toBe(
      "https://uploads.example/essay.txt",
    )
    expect(host.last("file-upload")).toMatchObject({ message: "file-upload", requestId: "r1" })
  })

  test("auto-confirms open-dialog echoing requestId", () => {
    const { iframePort, received } = installEmulator()
    iframePort.postMessage({
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
    iframePort.postMessage({ message: "height-changed", data: 100 })
    iframePort.postMessage({
      message: "current-state",
      data: { selectedOptionId: "x" },
      valid: true,
    })
    iframePort.postMessage({ message: "height-changed", data: 120 })

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
    iframePort.postMessage({
      message: "file-upload",
      requestId: "r2",
      files: new Map<string, string>([["a.txt", "x"]]),
    })
    expect(findMessage(received, "upload-result")).toBeUndefined()

    host.sendUploadResult("r2", { urls: { "a.txt": "https://cdn/x" } })
    const ok = findMessage(received, "upload-result")
    expect(ok).toMatchObject({ requestId: "r2", success: true })
    expect((ok?.urls as Map<string, string>).get("a.txt")).toBe("https://cdn/x")

    host.sendUploadResult("r2", { error: "boom" })
    const uploadResults = received.filter((message) => message.message === "upload-result")
    expect(uploadResults[uploadResults.length - 1]).toMatchObject({
      success: false,
      error: "boom",
    })
  })
})
