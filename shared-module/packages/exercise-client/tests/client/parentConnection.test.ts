import { createParentConnection } from "../../src/client/parentConnection"
import { createMockMessageChannel, createMockMessageEvent } from "../utils/iframeTestUtils"

describe("createParentConnection", () => {
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

  const deliverPort = (port: MessagePort) => {
    const event = createMockMessageEvent("communication-port", {
      source: window.parent,
      ports: [port],
    })
    messageListeners.forEach((listener) => listener(event))
  }

  it("posts ready on creation and exposes a null port until one is received", () => {
    const connection = createParentConnection({ onMessage: jest.fn() })
    expect(parentPostMessageSpy).toHaveBeenCalledWith("ready", "*")
    expect(connection.port).toBeNull()
    connection.dispose()
  })

  it("notifies onPort and exposes the port once received", () => {
    const connection = createParentConnection({ onMessage: jest.fn() })
    const onPort = jest.fn()
    connection.onPort(onPort)

    const channel = createMockMessageChannel()
    deliverPort(channel.port2 as unknown as MessagePort)

    expect(onPort).toHaveBeenCalledWith(channel.port2)
    expect(connection.port).toBe(channel.port2)
    connection.dispose()
  })

  it("calls a late onPort listener synchronously if the port already arrived", () => {
    const connection = createParentConnection({ onMessage: jest.fn() })
    const channel = createMockMessageChannel()
    deliverPort(channel.port2 as unknown as MessagePort)

    const late = jest.fn()
    connection.onPort(late)
    expect(late).toHaveBeenCalledWith(channel.port2)
    connection.dispose()
  })

  it("routes incoming port messages to onMessage", () => {
    const onMessage = jest.fn()
    const connection = createParentConnection({ onMessage })

    const channel = createMockMessageChannel()
    deliverPort(channel.port2 as unknown as MessagePort)

    const data = { message: "set-state", data: {} }
    channel.port2.onmessage?.({ data } as MessageEvent)

    expect(onMessage).toHaveBeenCalledWith(data, channel.port2)
    connection.dispose()
  })

  it("retries ready with exponential backoff and stops on dispose", () => {
    const connection = createParentConnection({ onMessage: jest.fn() })
    parentPostMessageSpy.mockClear()

    jest.advanceTimersByTime(1000)
    expect(parentPostMessageSpy).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(2000)
    expect(parentPostMessageSpy).toHaveBeenCalledTimes(2)

    connection.dispose()
    jest.advanceTimersByTime(10000)
    expect(parentPostMessageSpy).toHaveBeenCalledTimes(2)
  })

  it("stops retrying once the port is received", () => {
    const connection = createParentConnection({ onMessage: jest.fn() })
    const channel = createMockMessageChannel()
    parentPostMessageSpy.mockClear()

    deliverPort(channel.port2 as unknown as MessagePort)
    jest.advanceTimersByTime(20000)

    expect(parentPostMessageSpy).not.toHaveBeenCalled()
    connection.dispose()
  })

  it("ignores messages from sources other than the parent", () => {
    const connection = createParentConnection({ onMessage: jest.fn() })
    const channel = createMockMessageChannel()
    const event = createMockMessageEvent("communication-port", {
      source: {} as Window,
      ports: [channel.port2 as unknown as MessagePort],
    })
    messageListeners.forEach((listener) => listener(event))

    expect(connection.port).toBeNull()
    connection.dispose()
  })

  it("swallows errors thrown by the onMessage handler", () => {
    const onMessage = jest.fn().mockImplementation(() => {
      throw new Error("boom")
    })
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    const connection = createParentConnection({ onMessage })

    const channel = createMockMessageChannel()
    deliverPort(channel.port2 as unknown as MessagePort)
    channel.port2.onmessage?.({ data: { message: "x" } } as MessageEvent)

    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    connection.dispose()
  })

  it("removes the message listener on dispose", () => {
    const connection = createParentConnection({ onMessage: jest.fn() })
    connection.dispose()
    expect(removeEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function))
  })
})
