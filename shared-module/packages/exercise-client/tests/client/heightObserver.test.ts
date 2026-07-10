import { observeHeight } from "../../src/client/heightObserver"
import type { MockMessagePort } from "../utils/iframeTestUtils"
import { createMockMessagePort } from "../utils/iframeTestUtils"

describe("observeHeight", () => {
  let resizeCallbacks: (() => void)[]
  let originalResizeObserver: typeof ResizeObserver

  beforeEach(() => {
    jest.useFakeTimers()
    resizeCallbacks = []
    originalResizeObserver = (global as { ResizeObserver?: typeof ResizeObserver })
      .ResizeObserver as typeof ResizeObserver
    ;(global as { ResizeObserver: unknown }).ResizeObserver = class {
      public constructor(callback: () => void) {
        resizeCallbacks.push(callback)
      }
      public observe() {}
      public unobserve() {}
      public disconnect() {}
    }
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    ;(global as { ResizeObserver: unknown }).ResizeObserver = originalResizeObserver
  })

  const makeElement = () => {
    let height = 0
    const element = document.createElement("div")
    element.getBoundingClientRect = () => ({ height }) as DOMRect
    return { element, setHeight: (value: number) => (height = value) }
  }

  const triggerResize = () => resizeCallbacks.forEach((callback) => callback())

  it("posts the initial height to the port", () => {
    const port = createMockMessagePort()
    const { element, setHeight } = makeElement()
    setHeight(100)

    const observer = observeHeight({ element, port: port as unknown as MessagePort })
    expect(port.postMessage).toHaveBeenCalledWith({ message: "height-changed", data: 100 })
    observer.dispose()
  })

  it("does not re-post an unchanged height", () => {
    const port = createMockMessagePort()
    const { element, setHeight } = makeElement()
    setHeight(100)

    const observer = observeHeight({ element, port: port as unknown as MessagePort })
    ;(port.postMessage as jest.Mock).mockClear()
    triggerResize()
    expect(port.postMessage).not.toHaveBeenCalled()
    observer.dispose()
  })

  it("posts again when the height changes via the resize observer", () => {
    const port = createMockMessagePort()
    const { element, setHeight } = makeElement()
    setHeight(100)

    const observer = observeHeight({ element, port: port as unknown as MessagePort })
    ;(port.postMessage as jest.Mock).mockClear()
    setHeight(150)
    triggerResize()
    expect(port.postMessage).toHaveBeenCalledWith({ message: "height-changed", data: 150 })
    observer.dispose()
  })

  it("buffers the height until a port is set", () => {
    const { element, setHeight } = makeElement()
    setHeight(80)

    const observer = observeHeight({ element })
    const port: MockMessagePort = createMockMessagePort()
    observer.setPort(port as unknown as MessagePort)

    expect(port.postMessage).toHaveBeenCalledWith({ message: "height-changed", data: 80 })
    observer.dispose()
  })

  it("posts via the periodic safety poll when the height drifts", () => {
    const port = createMockMessagePort()
    const { element, setHeight } = makeElement()
    setHeight(100)

    const observer = observeHeight({ element, port: port as unknown as MessagePort })
    ;(port.postMessage as jest.Mock).mockClear()
    setHeight(200)
    jest.advanceTimersByTime(5000)
    expect(port.postMessage).toHaveBeenCalledWith({ message: "height-changed", data: 200 })
    observer.dispose()
  })

  it("stops the poll after dispose", () => {
    const port = createMockMessagePort()
    const { element, setHeight } = makeElement()
    setHeight(100)

    const observer = observeHeight({ element, port: port as unknown as MessagePort })
    observer.dispose()
    ;(port.postMessage as jest.Mock).mockClear()
    setHeight(300)
    jest.advanceTimersByTime(20000)
    expect(port.postMessage).not.toHaveBeenCalled()
  })
})
