"use client"

import { act, renderHook } from "@testing-library/react"

import useExerciseServiceParentConnection from "../../src/hooks/useExerciseServiceParentConnection"
import { createMockMessageChannel, createMockMessageEvent } from "../utils/iframeTestUtils"

describe("useExerciseServiceParentConnection", () => {
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

  describe("basic connection flow", () => {
    it("posts ready message on mount", () => {
      const onMessage = jest.fn()
      renderHook(() => useExerciseServiceParentConnection(onMessage))

      expect(parentPostMessageSpy).toHaveBeenCalledWith("ready", "*")
    })

    it("sets up message event listener", () => {
      const onMessage = jest.fn()
      renderHook(() => useExerciseServiceParentConnection(onMessage))

      expect(addEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function))
    })

    it("receives port from parent and sets it up", () => {
      const onMessage = jest.fn()
      const { result } = renderHook(() => useExerciseServiceParentConnection(onMessage))

      expect(result.current).toBeNull()

      const mockChannel = createMockMessageChannel()
      const event = createMockMessageEvent("communication-port", {
        source: window.parent,
        ports: [mockChannel.port2 as unknown as MessagePort],
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      expect(result.current).toBe(mockChannel.port2)
    })

    it("sets up port.onmessage handler when port is received", () => {
      const onMessage = jest.fn()
      renderHook(() => useExerciseServiceParentConnection(onMessage))

      const mockChannel = createMockMessageChannel()
      const event = createMockMessageEvent("communication-port", {
        source: window.parent,
        ports: [mockChannel.port2 as unknown as MessagePort],
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      expect(mockChannel.port2.onmessage).not.toBeNull()
    })

    it("calls onMessage callback when messages arrive via port", () => {
      const onMessage = jest.fn()
      renderHook(() => useExerciseServiceParentConnection(onMessage))

      const mockChannel = createMockMessageChannel()
      const event = createMockMessageEvent("communication-port", {
        source: window.parent,
        ports: [mockChannel.port2 as unknown as MessagePort],
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      const testData = { message: "set-state", data: { test: "data" } }
      act(() => {
        if (mockChannel.port2.onmessage) {
          mockChannel.port2.onmessage({ data: testData } as MessageEvent)
        }
      })

      expect(onMessage).toHaveBeenCalledWith(testData, mockChannel.port2)
    })
  })

  describe("retry mechanism", () => {
    it("schedules retry after initial ready message", () => {
      const onMessage = jest.fn()
      renderHook(() => useExerciseServiceParentConnection(onMessage))

      expect(parentPostMessageSpy).toHaveBeenCalledTimes(1)

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(parentPostMessageSpy).toHaveBeenCalledTimes(2)
    })

    it("retries with exponential backoff", () => {
      const onMessage = jest.fn()
      renderHook(() => useExerciseServiceParentConnection(onMessage))

      parentPostMessageSpy.mockClear()

      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(parentPostMessageSpy).toHaveBeenCalledTimes(1)

      act(() => {
        jest.advanceTimersByTime(2000)
      })
      expect(parentPostMessageSpy).toHaveBeenCalledTimes(2)

      act(() => {
        jest.advanceTimersByTime(4000)
      })
      expect(parentPostMessageSpy).toHaveBeenCalledTimes(3)
    })

    it("stops retrying once port is received", () => {
      const onMessage = jest.fn()
      renderHook(() => useExerciseServiceParentConnection(onMessage))

      const mockChannel = createMockMessageChannel()
      const event = createMockMessageEvent("communication-port", {
        source: window.parent,
        ports: [mockChannel.port2 as unknown as MessagePort],
      })

      parentPostMessageSpy.mockClear()

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      act(() => {
        jest.advanceTimersByTime(10000)
      })

      expect(parentPostMessageSpy).not.toHaveBeenCalled()
    })

    it("caps retry delay at 10 seconds", () => {
      const onMessage = jest.fn()
      renderHook(() => useExerciseServiceParentConnection(onMessage))

      parentPostMessageSpy.mockClear()

      act(() => {
        jest.advanceTimersByTime(1000)
      })
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      act(() => {
        jest.advanceTimersByTime(4000)
      })
      act(() => {
        jest.advanceTimersByTime(8000)
      })

      expect(parentPostMessageSpy).toHaveBeenCalledTimes(4)

      act(() => {
        jest.advanceTimersByTime(10000)
      })

      expect(parentPostMessageSpy).toHaveBeenCalledTimes(5)
    })
  })

  describe("onMessage callback handling", () => {
    it("uses ref to store latest onMessage callback", () => {
      let onMessage = jest.fn()
      const { rerender } = renderHook(() => useExerciseServiceParentConnection(onMessage))

      const mockChannel = createMockMessageChannel()
      const event = createMockMessageEvent("communication-port", {
        source: window.parent,
        ports: [mockChannel.port2 as unknown as MessagePort],
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      const newOnMessage = jest.fn()
      onMessage = newOnMessage
      rerender()

      const testData = { message: "test" }
      act(() => {
        if (mockChannel.port2.onmessage) {
          mockChannel.port2.onmessage({ data: testData } as MessageEvent)
        }
      })

      expect(newOnMessage).toHaveBeenCalledWith(testData, mockChannel.port2)
    })

    it("effect doesn't re-run when onMessage changes", () => {
      let onMessage = jest.fn()
      const { rerender } = renderHook(() => useExerciseServiceParentConnection(onMessage))

      const initialCallCount = parentPostMessageSpy.mock.calls.length

      onMessage = jest.fn()
      rerender()

      expect(parentPostMessageSpy.mock.calls.length).toBe(initialCallCount)
    })
  })

  describe("port handler timing", () => {
    it("sets port.onmessage before setPort", () => {
      const onMessage = jest.fn()
      const { result } = renderHook(() => useExerciseServiceParentConnection(onMessage))

      const mockChannel = createMockMessageChannel()
      let handlerSetBeforeStateUpdate = false

      mockChannel.port2.onmessage = null
      const originalSetOnmessage = Object.getOwnPropertyDescriptor(mockChannel.port2, "onmessage")

      Object.defineProperty(mockChannel.port2, "onmessage", {
        set(value) {
          if (result.current === null) {
            handlerSetBeforeStateUpdate = true
          }
          if (originalSetOnmessage?.set) {
            originalSetOnmessage.set.call(this, value)
          }
        },
        get() {
          return originalSetOnmessage?.get?.call(this)
        },
      })

      const event = createMockMessageEvent("communication-port", {
        source: window.parent,
        ports: [mockChannel.port2 as unknown as MessagePort],
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      expect(handlerSetBeforeStateUpdate).toBe(true)
    })
  })

  describe("multiple ready messages", () => {
    it("only sets up port handler once", () => {
      const onMessage = jest.fn()
      renderHook(() => useExerciseServiceParentConnection(onMessage))

      const mockChannel = createMockMessageChannel()
      const event = createMockMessageEvent("communication-port", {
        source: window.parent,
        ports: [mockChannel.port2 as unknown as MessagePort],
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      const firstHandler = mockChannel.port2.onmessage

      const mockChannel2 = createMockMessageChannel()
      const event2 = createMockMessageEvent("communication-port", {
        source: window.parent,
        ports: [mockChannel2.port2 as unknown as MessagePort],
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event2))
      })

      expect(mockChannel.port2.onmessage).toBe(firstHandler)
      expect(mockChannel2.port2.onmessage).toBeNull()
    })

    it("stops posting ready messages after port received", () => {
      const onMessage = jest.fn()
      renderHook(() => useExerciseServiceParentConnection(onMessage))

      const mockChannel = createMockMessageChannel()
      const event = createMockMessageEvent("communication-port", {
        source: window.parent,
        ports: [mockChannel.port2 as unknown as MessagePort],
      })

      parentPostMessageSpy.mockClear()

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      act(() => {
        jest.advanceTimersByTime(20000)
      })

      expect(parentPostMessageSpy).not.toHaveBeenCalled()
    })
  })

  describe("cleanup", () => {
    it("removes event listener on unmount", () => {
      const onMessage = jest.fn()
      const { unmount } = renderHook(() => useExerciseServiceParentConnection(onMessage))

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function))
    })

    it("clears retry timeout on unmount", () => {
      const onMessage = jest.fn()
      const { unmount } = renderHook(() => useExerciseServiceParentConnection(onMessage))

      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout")

      unmount()

      expect(clearTimeoutSpy).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })

    it("doesn't post messages after unmount", () => {
      const onMessage = jest.fn()
      const { unmount } = renderHook(() => useExerciseServiceParentConnection(onMessage))

      parentPostMessageSpy.mockClear()

      unmount()

      act(() => {
        jest.advanceTimersByTime(20000)
      })

      expect(parentPostMessageSpy).not.toHaveBeenCalled()
    })
  })

  describe("edge cases", () => {
    it("ignores messages from sources other than parent", () => {
      const onMessage = jest.fn()
      const { result } = renderHook(() => useExerciseServiceParentConnection(onMessage))

      const mockChannel = createMockMessageChannel()
      const otherWindow = {} as Window
      const event = createMockMessageEvent("communication-port", {
        source: otherWindow,
        ports: [mockChannel.port2 as unknown as MessagePort],
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      expect(result.current).toBeNull()
    })

    it("handles errors in onMessage callback gracefully", () => {
      const onMessage = jest.fn().mockImplementation(() => {
        throw new Error("Test error")
      })
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

      renderHook(() => useExerciseServiceParentConnection(onMessage))

      const mockChannel = createMockMessageChannel()
      const event = createMockMessageEvent("communication-port", {
        source: window.parent,
        ports: [mockChannel.port2 as unknown as MessagePort],
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      const testData = { message: "test" }
      act(() => {
        if (mockChannel.port2.onmessage) {
          mockChannel.port2.onmessage({ data: testData } as MessageEvent)
        }
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })
})
