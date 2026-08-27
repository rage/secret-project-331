"use client"

import { act, render, screen } from "@testing-library/react"
import React from "react"

import { useChartNaturalHeight } from "../useChartNaturalHeight"

const DEBOUNCE_MS = 150

// jsdom implements neither ResizeObserver nor layout, so both are stood in for here.
class ResizeObserverStub {
  public static instances: ResizeObserverStub[] = []
  public disconnected = false

  private callback: ResizeObserverCallback

  public constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    ResizeObserverStub.instances.push(this)
  }

  public observe() {}
  public unobserve() {}
  public disconnect() {
    this.disconnected = true
  }

  /** Reports a resize the way the browser would once Vega has drawn. */
  public resize() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

let renderedHeight = 0

const originalResizeObserver = global.ResizeObserver

beforeAll(() => {
  global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => renderedHeight,
  })
})

afterAll(() => {
  global.ResizeObserver = originalResizeObserver
  Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight")
})

beforeEach(() => {
  jest.useFakeTimers()
  ResizeObserverStub.instances = []
  renderedHeight = 0
})

afterEach(() => {
  jest.useRealTimers()
})

const Chart: React.FC<{ hideChart?: boolean }> = ({ hideChart }) => {
  const { chartRef, naturalHeightPx } = useChartNaturalHeight(DEBOUNCE_MS)
  return (
    <>
      <span data-testid="height">
        {naturalHeightPx === null ? "unmeasured" : String(naturalHeightPx)}
      </span>
      {!hideChart && <div ref={chartRef} data-testid="chart" />}
    </>
  )
}

const reportedHeight = () => screen.getByTestId("height").textContent

const observer = () => ResizeObserverStub.instances[0]

describe("useChartNaturalHeight", () => {
  it("does not report a height before the chart has drawn anything", () => {
    render(<Chart />)

    expect(reportedHeight()).toBe("unmeasured")
  })

  it("measures the chart as soon as it has a height", () => {
    renderedHeight = 420
    render(<Chart />)

    expect(reportedHeight()).toBe("420")
  })

  it("remeasures once Vega has redrawn and the resizing has settled", () => {
    renderedHeight = 420
    render(<Chart />)

    renderedHeight = 500
    act(() => observer()?.resize())
    expect(reportedHeight()).toBe("420")

    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS)
    })
    expect(reportedHeight()).toBe("500")
  })

  it("measures once for a burst of resizes, at the height they end on", () => {
    renderedHeight = 420
    render(<Chart />)

    renderedHeight = 500
    act(() => observer()?.resize())
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS - 1)
    })
    renderedHeight = 600
    act(() => observer()?.resize())
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(reportedHeight()).toBe("600")
  })

  it("keeps the last height it knew when the chart reports zero, as it does mid-redraw", () => {
    renderedHeight = 420
    render(<Chart />)

    renderedHeight = 0
    act(() => observer()?.resize())
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(reportedHeight()).toBe("420")
  })

  it("stops observing the chart when it is taken out of the tree", () => {
    renderedHeight = 420
    const { rerender } = render(<Chart />)

    rerender(<Chart hideChart />)

    expect(observer()?.disconnected).toBe(true)
  })

  it("leaves no pending measurement behind on unmount", () => {
    renderedHeight = 420
    const { unmount } = render(<Chart />)

    renderedHeight = 500
    observer()?.resize()
    unmount()

    expect(jest.getTimerCount()).toBe(0)
  })
})
