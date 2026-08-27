/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import { act, render, screen } from "@testing-library/react"
import React from "react"

import { useDebouncedElementWidth } from "../../src/hooks/useDebouncedElementWidth"

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

  /** Reports a resize the way the browser would. */
  public resize() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

let measuredWidth = 0

const originalResizeObserver = global.ResizeObserver
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

beforeAll(() => {
  global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { width: measuredWidth } as DOMRect
  }
})

afterAll(() => {
  global.ResizeObserver = originalResizeObserver
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
})

beforeEach(() => {
  jest.useFakeTimers()
  ResizeObserverStub.instances = []
  measuredWidth = 0
})

afterEach(() => {
  jest.useRealTimers()
})

const Measured: React.FC = () => {
  const { ref, width } = useDebouncedElementWidth<HTMLDivElement>(DEBOUNCE_MS)
  return (
    <div ref={ref} data-testid="box">
      {width === null ? "unmeasured" : String(width)}
    </div>
  )
}

const reportedWidth = () => screen.getByTestId("box").textContent

const observer = () => ResizeObserverStub.instances[0]

const resizeTo = (width: number) => {
  measuredWidth = width
  act(() => observer()?.resize())
}

describe("useDebouncedElementWidth", () => {
  it("measures the element as soon as it mounts", () => {
    measuredWidth = 800
    render(<Measured />)

    expect(reportedWidth()).toBe("800")
  })

  it("rounds a fractional width down, so the chart is never drawn wider than its box", () => {
    measuredWidth = 640.7
    render(<Measured />)

    expect(reportedWidth()).toBe("640")
  })

  it("remeasures only once resizing has settled", () => {
    measuredWidth = 800
    render(<Measured />)

    resizeTo(500)
    expect(reportedWidth()).toBe("800")

    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS)
    })
    expect(reportedWidth()).toBe("500")
  })

  it("measures once for a burst of resizes, at the width they end on", () => {
    measuredWidth = 800
    render(<Measured />)

    resizeTo(700)
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS - 1)
    })
    resizeTo(600)
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(reportedWidth()).toBe("600")
  })

  it("stops observing when the element goes away", () => {
    measuredWidth = 800
    const { unmount } = render(<Measured />)

    unmount()

    expect(observer()?.disconnected).toBe(true)
  })

  it("does not measure after unmounting", () => {
    measuredWidth = 800
    const { unmount } = render(<Measured />)
    const resizeObserver = observer()

    measuredWidth = 500
    resizeObserver?.resize()
    unmount()
    // The pending measurement must not run against an unmounted component.
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(jest.getTimerCount()).toBe(0)
  })
})
