import { createExerciseClient } from "../../src/client/createExerciseClient"
import { createMockMessageChannel, createMockMessageEvent } from "../utils/iframeTestUtils"

describe("createExerciseClient", () => {
  let addEventListenerSpy: jest.SpyInstance
  let removeEventListenerSpy: jest.SpyInstance
  let parentPostMessageSpy: jest.SpyInstance
  let messageListeners: Array<(event: MessageEvent) => void>

  beforeEach(() => {
    jest.useFakeTimers()
    messageListeners = []

    addEventListenerSpy = jest
      .spyOn(window, "addEventListener")
      .mockImplementation((type, listener) => {
        if (type === "message") {
          messageListeners.push(listener as (event: MessageEvent) => void)
        }
      })
    removeEventListenerSpy = jest
      .spyOn(window, "removeEventListener")
      .mockImplementation((type, listener) => {
        if (type === "message") {
          const index = messageListeners.indexOf(listener as (event: MessageEvent) => void)
          if (index > -1) {
            messageListeners.splice(index, 1)
          }
        }
      })
    parentPostMessageSpy = jest.spyOn(window.parent, "postMessage").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
    parentPostMessageSpy.mockRestore()
  })

  const connectPort = () => {
    const channel = createMockMessageChannel()
    const event = createMockMessageEvent("communication-port", {
      source: window.parent,
      ports: [channel.port2 as unknown as MessagePort],
    })
    messageListeners.forEach((listener) => listener(event))
    return channel
  }

  it("resolves ready and wires the output engine once the port arrives", async () => {
    const client = createExerciseClient<{ items: number[] }>({
      validate: () => true,
      initialState: { items: [] },
    })
    const channel = connectPort()

    await expect(client.ready).resolves.toBe(channel.port2)
    expect(client.port).toBe(channel.port2)

    client.output.update(
      (s) => s,
      (s) => {
        s?.items.push(1)
      },
    )
    expect(channel.port2.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: "current-state" }),
    )
    client.dispose()
  })

  it("routes set-state messages to onSetState handlers", () => {
    const client = createExerciseClient()
    const channel = connectPort()

    const onSetState = jest.fn()
    client.onSetState(onSetState)

    const message = { message: "set-state", view_type: "answer-exercise", data: {} }
    channel.port2.onmessage?.({ data: message } as MessageEvent)

    expect(onSetState).toHaveBeenCalledWith(message)
    client.dispose()
  })

  it("routes set-language messages with the language code", () => {
    const client = createExerciseClient()
    const channel = connectPort()

    const onSetLanguage = jest.fn()
    client.onSetLanguage(onSetLanguage)

    channel.port2.onmessage?.({ data: { message: "set-language", data: "fi" } } as MessageEvent)

    expect(onSetLanguage).toHaveBeenCalledWith("fi")
    client.dispose()
  })

  it("forwards every message to onMessage handlers", () => {
    const client = createExerciseClient()
    const channel = connectPort()

    const onMessage = jest.fn()
    client.onMessage(onMessage)

    const message = { message: "set-language", data: "en" }
    channel.port2.onmessage?.({ data: message } as MessageEvent)

    expect(onMessage).toHaveBeenCalledWith(message)
    client.dispose()
  })
})
