"use client"

import { act, render, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { I18nextProvider } from "react-i18next"

import MessageChannelIFrame from "../../src/components/MessageChannelIFrame"
import i18nTest from "../../src/utils/testing/i18nTest"
import { createMockMessageChannel, createMockMessageEvent } from "../utils/iframeTestUtils"

const server = setupServer(
  http.get("/example-iframe-page", (_info) => {
    return new HttpResponse("<html>Hello from iframe</html>")
  }),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("MessageChannelIFrame", () => {
  let messageListeners: Array<(event: MessageEvent) => void>
  let addEventListenerSpy: jest.SpyInstance
  let removeEventListenerSpy: jest.SpyInstance

  beforeEach(() => {
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
  })

  afterEach(() => {
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  test("It renders", async () => {
    window.MessageChannel = jest
      .fn()
      .mockReturnValue({ port1: { postMessage: jest.fn() }, port2: {} })

    const res = render(
      <I18nextProvider i18n={i18nTest}>
        <MessageChannelIFrame
          url="http://example.com/example-iframe-page"
          postThisStateToIFrame={{
            view_type: "answer-exercise",
            exercise_task_id: "2c75563d-4129-49dd-9515-e55e006f875d",
            user_information: { pseudonymous_id: "id", signed_in: false },
            data: { public_spec: {}, previous_submission: null },
          }}
          onMessageFromIframe={(message, responsePort) => {
            console.info(message, responsePort)
          }}
          title="test"
        />
      </I18nextProvider>,
    )
    await waitFor(() => res.container.querySelector("iframe"))
    expect(res.container.querySelector("iframe")?.src).toBe(
      "http://example.com/example-iframe-page",
    )
  })

  describe("basic connection flow", () => {
    it("creates MessageChannel synchronously", () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      expect(window.MessageChannel).toHaveBeenCalled()
    })

    it("sets up listener for ready messages", () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      expect(addEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function))
    })

    it("sends port when ready message is received", async () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))
      expect(iframe).not.toBeNull()

      const mockContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(iframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      })

      const event = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      expect(mockContentWindow.postMessage).toHaveBeenCalledWith("communication-port", "*", [
        mockChannel.port2,
      ])
    })
  })

  describe("early ready message handling", () => {
    it("queues ready messages received before messageChannel is available", async () => {
      let channelCreated = false
      const mockChannel = createMockMessageChannel()
      window.MessageChannel = jest.fn().mockImplementation(() => {
        channelCreated = true
        return mockChannel
      })

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))
      const mockContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(iframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      })

      expect(channelCreated).toBe(true)

      const event = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      await waitFor(() => {
        expect(mockContentWindow.postMessage).toHaveBeenCalled()
      })
    })
  })

  describe("multiple ready messages", () => {
    it("only sends port once", async () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))
      const mockContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(iframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      })

      const event1 = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event1))
      })

      const event2 = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event2))
      })

      expect(mockContentWindow.postMessage).toHaveBeenCalledTimes(1)
    })
  })

  describe("request-iframe-reload handling", () => {
    it("reloads iframe with exponential backoff and re-establishes the handshake", async () => {
      jest.useFakeTimers()
      const mockChannels = [
        createMockMessageChannel(),
        createMockMessageChannel(),
        createMockMessageChannel(),
      ]
      let channelIndex = 0
      window.MessageChannel = jest.fn().mockImplementation(() => {
        const channel = mockChannels[channelIndex]
        channelIndex += 1
        return channel
      })

      const stateToPost = {
        view_type: "answer-exercise" as const,
        exercise_task_id: "test-id",
        user_information: { pseudonymous_id: "id", signed_in: false },
        data: { public_spec: {}, previous_submission: null },
      }

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={stateToPost}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const dispatchReady = (iframeWindow: { postMessage: jest.Mock }) => {
        const readyEvent = createMockMessageEvent("ready", {
          source: iframeWindow as unknown as Window,
          origin: "null",
        })

        act(() => {
          messageListeners.forEach((listener) => listener(readyEvent))
        })
      }

      const firstIframe = (await waitFor(() => {
        const iframe = container.querySelector("iframe")
        expect(iframe).not.toBeNull()
        return iframe
      })) as HTMLIFrameElement
      const firstContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(firstIframe, "contentWindow", {
        value: firstContentWindow,
        writable: true,
      })

      dispatchReady(firstContentWindow)

      expect(firstContentWindow.postMessage).toHaveBeenCalledWith("communication-port", "*", [
        mockChannels[0].port2,
      ])
      await waitFor(() => {
        expect(mockChannels[0].port1.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "set-state",
            ...stateToPost,
          }),
        )
      })

      const triggerReload = (channel: (typeof mockChannels)[number], delay: number) => {
        act(() => {
          channel.port1.onmessage?.({
            data: { message: "request-iframe-reload" },
          } as unknown as MessageEvent)
          jest.advanceTimersByTime(delay - 1)
        })

        expect(container.querySelector("iframe")).toBe(firstIframe)

        act(() => {
          jest.advanceTimersByTime(1)
        })
      }

      triggerReload(mockChannels[0], 250)
      const secondIframe = (await waitFor(() => {
        const currentIframe = container.querySelector("iframe")
        expect(currentIframe).not.toBe(firstIframe)
        return currentIframe
      })) as HTMLIFrameElement

      const secondContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(secondIframe, "contentWindow", {
        value: secondContentWindow,
        writable: true,
      })

      dispatchReady(secondContentWindow)

      expect(secondContentWindow.postMessage).toHaveBeenCalledWith(
        "communication-port",
        "*",
        expect.any(Array),
      )
      expect(window.MessageChannel).toHaveBeenCalledTimes(2)
      await waitFor(() => {
        expect(mockChannels[1].port1.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "set-state",
            ...stateToPost,
          }),
        )
      })

      act(() => {
        mockChannels[1].port1.onmessage?.({
          data: { message: "request-iframe-reload" },
        } as unknown as MessageEvent)
        jest.advanceTimersByTime(499)
      })

      expect(container.querySelector("iframe")).toBe(secondIframe)

      act(() => {
        jest.advanceTimersByTime(1)
      })

      await waitFor(() => {
        expect(container.querySelector("iframe")).not.toBe(secondIframe)
      })

      jest.useRealTimers()
    })

    it("shows manual reload UI when attempts are exhausted and allows restarting reloads", async () => {
      jest.useFakeTimers()
      const mockChannels = Array.from({ length: 6 }, () => createMockMessageChannel())
      let channelIndex = 0
      window.MessageChannel = jest.fn().mockImplementation(() => {
        const channel = mockChannels[channelIndex]
        channelIndex += 1
        return channel
      })

      const { container, getByText } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      let currentIframe = (await waitFor(() => {
        const iframe = container.querySelector("iframe")
        expect(iframe).not.toBeNull()
        return iframe
      })) as HTMLIFrameElement
      const mockContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(currentIframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      })

      const readyEvent = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(readyEvent))
      })

      const triggerReloadRequest = (channel: (typeof mockChannels)[number], delay?: number) => {
        act(() => {
          channel.port1.onmessage?.({
            data: { message: "request-iframe-reload" },
          } as unknown as MessageEvent)
          if (delay) {
            jest.advanceTimersByTime(delay)
          }
        })
      }

      // Exhaust automatic attempts
      triggerReloadRequest(mockChannels[0], 250)
      currentIframe = (await waitFor(() => {
        const nextIframe = container.querySelector("iframe")
        expect(nextIframe).not.toBeNull()
        expect(nextIframe).not.toBe(currentIframe)
        return nextIframe
      })) as HTMLIFrameElement

      triggerReloadRequest(mockChannels[1], 500)
      currentIframe = (await waitFor(() => {
        const nextIframe = container.querySelector("iframe")
        expect(nextIframe).not.toBeNull()
        expect(nextIframe).not.toBe(currentIframe)
        return nextIframe
      })) as HTMLIFrameElement

      triggerReloadRequest(mockChannels[2], 1000)
      currentIframe = (await waitFor(() => {
        const nextIframe = container.querySelector("iframe")
        expect(nextIframe).not.toBeNull()
        expect(nextIframe).not.toBe(currentIframe)
        return nextIframe
      })) as HTMLIFrameElement

      triggerReloadRequest(mockChannels[3], 2000)
      currentIframe = (await waitFor(() => {
        const nextIframe = container.querySelector("iframe")
        expect(nextIframe).not.toBeNull()
        expect(nextIframe).not.toBe(currentIframe)
        return nextIframe
      })) as HTMLIFrameElement

      triggerReloadRequest(mockChannels[4])

      const exhaustedText = getByText(i18nTest.t("exercise-iframe-reload-exhausted-message"))
      expect(exhaustedText).toBeInTheDocument()

      const button = getByText(i18nTest.t("exercise-iframe-reload-exhausted-reload-button"))
      const iframeBeforeManualReload = currentIframe

      act(() => {
        button.click()
        jest.advanceTimersByTime(249)
      })

      expect(container.querySelector("iframe")).toBe(iframeBeforeManualReload)

      act(() => {
        jest.advanceTimersByTime(1)
      })

      await waitFor(() => {
        expect(container.querySelector("iframe")).not.toBe(iframeBeforeManualReload)
      })

      jest.useRealTimers()
    })
  })

  describe("origin verification", () => {
    it("accepts messages from null origin (sandboxed iframe)", async () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))
      const mockContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(iframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      })

      const event = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      expect(mockContentWindow.postMessage).toHaveBeenCalled()
    })

    it("accepts messages from window.location.origin (non-sandboxed)", async () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))
      const mockContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(iframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      })

      const event = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: window.location.origin,
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      expect(mockContentWindow.postMessage).toHaveBeenCalled()
    })

    it("rejects messages from invalid origin", async () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))
      const mockContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(iframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      })

      const event = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "https://evil.com",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      expect(mockContentWindow.postMessage).not.toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalled()
      consoleWarnSpy.mockRestore()
    })
  })

  describe("contentWindow availability", () => {
    it("doesn't crash when contentWindow is null", async () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))
      Object.defineProperty(iframe, "contentWindow", {
        value: null,
        writable: true,
      })

      const event = createMockMessageEvent("ready", {
        source: null,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event))
      })

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining("crash"))
      consoleErrorSpy.mockRestore()
    })
  })

  describe("URL changes", () => {
    it("resets portSentRef when URL changes", async () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const { container, rerender } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test1"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))
      const mockContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(iframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      })

      const event1 = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event1))
      })

      expect(mockContentWindow.postMessage).toHaveBeenCalledTimes(1)

      rerender(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test2"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const event2 = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event2))
      })

      expect(mockContentWindow.postMessage).toHaveBeenCalledTimes(2)
    })
  })

  describe("message handling after connection", () => {
    it("handles height-changed messages", async () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))

      act(() => {
        if (mockChannel.port1.onmessage) {
          mockChannel.port1.onmessage({
            data: { message: "height-changed", data: 500 },
          } as MessageEvent)
        }
      })

      await waitFor(() => {
        expect(iframe?.height).toBe("500px")
      })
    })

    it("calls onMessageFromIframe for custom messages", async () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const onMessageFromIframe = jest.fn()

      render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={onMessageFromIframe}
            title="test"
          />
        </I18nextProvider>,
      )

      const customMessage = {
        message: "current-state",
        data: { test: "value" },
        valid: true,
      }

      act(() => {
        if (mockChannel.port1.onmessage) {
          mockChannel.port1.onmessage({
            data: customMessage,
          } as MessageEvent)
        }
      })

      await waitFor(() => {
        expect(onMessageFromIframe).toHaveBeenCalledWith(customMessage, mockChannel.port1)
      })
    })
  })

  describe("state posting", () => {
    it("posts set-state messages via port", async () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const stateToPost = {
        view_type: "answer-exercise" as const,
        exercise_task_id: "test-id",
        user_information: { pseudonymous_id: "id", signed_in: false },
        data: { public_spec: {}, previous_submission: null },
      }

      render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={stateToPost}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      await waitFor(() => {
        expect(mockChannel.port1.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "set-state",
            ...stateToPost,
          }),
        )
      })
    })

    it("doesn't repost same state", async () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const stateToPost = {
        view_type: "answer-exercise" as const,
        exercise_task_id: "test-id",
        user_information: { pseudonymous_id: "id", signed_in: false },
        data: { public_spec: {}, previous_submission: null },
      }

      const { rerender } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={stateToPost}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      await waitFor(() => {
        expect(mockChannel.port1.postMessage).toHaveBeenCalled()
      })

      const callCount = mockChannel.port1.postMessage.mock.calls.length

      rerender(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={stateToPost}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      expect(mockChannel.port1.postMessage.mock.calls.length).toBe(callCount)
    })
  })

  describe("cleanup", () => {
    it("removes listeners on unmount", () => {
      const mockChannel = createMockMessageChannel()

      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const { unmount } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function))
    })
  })

  describe("port transfer recovery", () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it("triggers recovery when ready arrives 5+ seconds after port sent", async () => {
      const mockChannel1 = createMockMessageChannel()
      const mockChannel2 = createMockMessageChannel()
      let channelCallCount = 0
      window.MessageChannel = jest.fn().mockImplementation(() => {
        channelCallCount++
        return channelCallCount === 1 ? mockChannel1 : mockChannel2
      })

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))
      const mockContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(iframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      })

      const event1 = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event1))
      })

      expect(mockContentWindow.postMessage).toHaveBeenCalledTimes(1)
      expect(mockContentWindow.postMessage).toHaveBeenCalledWith("communication-port", "*", [
        mockChannel1.port2,
      ])

      act(() => {
        jest.advanceTimersByTime(6000)
      })

      const event2 = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event2))
      })

      await waitFor(() => {
        expect(mockContentWindow.postMessage).toHaveBeenCalledTimes(2)
      })

      expect(mockContentWindow.postMessage).toHaveBeenLastCalledWith("communication-port", "*", [
        mockChannel2.port2,
      ])
    })

    it("doesn't trigger recovery if ready arrives within 5 seconds", async () => {
      const mockChannel = createMockMessageChannel()
      window.MessageChannel = jest.fn().mockReturnValue(mockChannel)

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))
      const mockContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(iframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      })

      const event1 = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event1))
      })

      expect(mockContentWindow.postMessage).toHaveBeenCalledTimes(1)

      act(() => {
        jest.advanceTimersByTime(3000)
      })

      const event2 = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event2))
      })

      expect(mockContentWindow.postMessage).toHaveBeenCalledTimes(1)
    })

    it("limits recovery attempts to max 3", async () => {
      const mockChannels = [
        createMockMessageChannel(),
        createMockMessageChannel(),
        createMockMessageChannel(),
        createMockMessageChannel(),
      ]
      let channelCallCount = 0
      window.MessageChannel = jest.fn().mockImplementation(() => {
        const channel = mockChannels[channelCallCount]
        channelCallCount++
        return channel
      })

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={null}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))
      const mockContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(iframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      })

      for (let i = 0; i < 5; i++) {
        const event = createMockMessageEvent("ready", {
          source: mockContentWindow as unknown as Window,
          origin: "null",
        })

        act(() => {
          messageListeners.forEach((listener) => listener(event))
        })

        act(() => {
          jest.advanceTimersByTime(6000)
        })
      }

      await waitFor(() => {
        expect(mockContentWindow.postMessage).toHaveBeenCalledTimes(4)
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Max recovery attempts"))

      consoleErrorSpy.mockRestore()
    })

    it("posts current state after recovery", async () => {
      const mockChannel1 = createMockMessageChannel()
      const mockChannel2 = createMockMessageChannel()
      let channelCallCount = 0
      window.MessageChannel = jest.fn().mockImplementation(() => {
        channelCallCount++
        return channelCallCount === 1 ? mockChannel1 : mockChannel2
      })

      const stateToPost = {
        view_type: "answer-exercise" as const,
        exercise_task_id: "test-id",
        user_information: { pseudonymous_id: "id", signed_in: false },
        data: { public_spec: {}, previous_submission: null },
      }

      const { container } = render(
        <I18nextProvider i18n={i18nTest}>
          <MessageChannelIFrame
            url="http://example.com/test"
            postThisStateToIFrame={stateToPost}
            onMessageFromIframe={jest.fn()}
            title="test"
          />
        </I18nextProvider>,
      )

      const iframe = await waitFor(() => container.querySelector("iframe"))
      const mockContentWindow = {
        postMessage: jest.fn(),
      }
      Object.defineProperty(iframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      })

      const event1 = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event1))
      })

      await waitFor(() => {
        expect(mockChannel1.port1.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "set-state",
            ...stateToPost,
          }),
        )
      })

      mockChannel1.port1.postMessage.mockClear()

      act(() => {
        jest.advanceTimersByTime(6000)
      })

      const event2 = createMockMessageEvent("ready", {
        source: mockContentWindow as unknown as Window,
        origin: "null",
      })

      act(() => {
        messageListeners.forEach((listener) => listener(event2))
      })

      await waitFor(() => {
        expect(mockChannel2.port1.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "set-state",
            ...stateToPost,
          }),
        )
      })
    })
  })
})
