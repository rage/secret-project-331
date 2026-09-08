/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import { act, render, screen } from "@testing-library/react"
import React from "react"

import { useChartNaturalSize } from "../../../src/blocks/Chart/useChartNaturalSize"

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
let renderedSvgWidth = 0

const originalResizeObserver = global.ResizeObserver

beforeAll(() => {
  global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => renderedHeight,
  })
  Object.defineProperty(SVGElement.prototype, "clientWidth", {
    configurable: true,
    get: () => renderedSvgWidth,
  })
})

afterAll(() => {
  global.ResizeObserver = originalResizeObserver
  Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight")
  Reflect.deleteProperty(SVGElement.prototype, "clientWidth")
})

beforeEach(() => {
  jest.useFakeTimers()
  ResizeObserverStub.instances = []
  renderedHeight = 0
  renderedSvgWidth = 0
})

afterEach(() => {
  jest.useRealTimers()
})

interface ChartProps {
  onHeightChange?: (heightPx: number) => void
  /** Whether Vega has drawn its SVG yet. */
  hasSvg?: boolean
}

const Chart: React.FC<ChartProps> = ({ onHeightChange, hasSvg = true }) => {
  const { chartRef, naturalHeightPx, naturalWidthPx } = useChartNaturalSize({
    debounceMs: DEBOUNCE_MS,
    onHeightChange,
  })
  return (
    <>
      <span data-testid="height">{naturalHeightPx === null ? "none" : naturalHeightPx}</span>
      <span data-testid="width">{naturalWidthPx === null ? "none" : naturalWidthPx}</span>
      <div ref={chartRef}>{hasSvg && <svg data-testid="svg" />}</div>
    </>
  )
}

const measured = (dimension: "height" | "width") => screen.getByTestId(dimension).textContent

const observer = () => ResizeObserverStub.instances[0]

const settleResize = () => {
  act(() => observer()?.resize())
  act(() => {
    jest.advanceTimersByTime(DEBOUNCE_MS)
  })
}

describe("useChartNaturalSize", () => {
  it("reports nothing before the chart has drawn", () => {
    render(<Chart />)

    expect(measured("height")).toBe("none")
    expect(measured("width")).toBe("none")
  })

  it("measures the chart's own height and the width of the SVG it drew", () => {
    renderedHeight = 420
    renderedSvgWidth = 900
    render(<Chart />)

    expect(measured("height")).toBe("420")
    expect(measured("width")).toBe("900")
  })

  it("tells the caller each new height, so it can size its own box to match", () => {
    const onHeightChange = jest.fn<(heightPx: number) => void>()
    renderedHeight = 420
    render(<Chart onHeightChange={onHeightChange} />)

    expect(onHeightChange).toHaveBeenCalledWith(420)

    renderedHeight = 500
    settleResize()

    expect(onHeightChange).toHaveBeenLastCalledWith(500)
  })

  it("does not repeat a height that has not changed", () => {
    const onHeightChange = jest.fn<(heightPx: number) => void>()
    renderedHeight = 420
    render(<Chart onHeightChange={onHeightChange} />)

    settleResize()

    expect(onHeightChange).toHaveBeenCalledTimes(1)
  })

  it("waits for resizing to settle before remeasuring", () => {
    renderedHeight = 420
    render(<Chart />)

    renderedHeight = 500
    act(() => observer()?.resize())
    expect(measured("height")).toBe("420")

    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS)
    })
    expect(measured("height")).toBe("500")
  })

  it("keeps the size it knew when the chart momentarily reports zero", () => {
    renderedHeight = 420
    renderedSvgWidth = 900
    render(<Chart />)

    renderedHeight = 0
    renderedSvgWidth = 0
    settleResize()

    expect(measured("height")).toBe("420")
    expect(measured("width")).toBe("900")
  })

  it("reports only a height until Vega has drawn its SVG", () => {
    renderedHeight = 420
    renderedSvgWidth = 900
    render(<Chart hasSvg={false} />)

    expect(measured("height")).toBe("420")
    expect(measured("width")).toBe("none")
  })

  it("stops observing the chart when it goes away", () => {
    renderedHeight = 420
    const { unmount } = render(<Chart />)

    unmount()

    expect(observer()?.disconnected).toBe(true)
    expect(jest.getTimerCount()).toBe(0)
  })
})
