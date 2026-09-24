/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { useVerticalResizeHandle } from "../../src/hooks/useVerticalResizeHandle"

const INITIAL = 360
const MIN = 160
const MAX = 900
const STEP = 40

const HANDLE_LABEL = "resize"

const Resizable: React.FC = () => {
  const { heightPx, handleProps } = useVerticalResizeHandle({
    initialHeightPx: INITIAL,
    minHeightPx: MIN,
    maxHeightPx: MAX,
    keyboardStepPx: STEP,
  })
  return (
    <>
      <div data-testid="pane">{heightPx}</div>
      <div role="separator" aria-label={HANDLE_LABEL} {...handleProps} />
    </>
  )
}

const handle = () => screen.getByRole("separator", { name: HANDLE_LABEL })

const height = () => screen.getByTestId("pane").textContent

// jsdom implements neither PointerEvent nor pointer capture. Without the event the handlers see no
// coordinates at all, so a drag would look like it moved nowhere.
class PointerEventStub extends MouseEvent {
  public pointerId: number

  public constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 0
  }
}

const originalPointerEvent = global.PointerEvent
const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture
const originalReleasePointerCapture = HTMLElement.prototype.releasePointerCapture

beforeAll(() => {
  global.PointerEvent = PointerEventStub as unknown as typeof PointerEvent
  HTMLElement.prototype.setPointerCapture = jest.fn()
  HTMLElement.prototype.releasePointerCapture = jest.fn()
})

afterAll(() => {
  global.PointerEvent = originalPointerEvent
  HTMLElement.prototype.setPointerCapture = originalSetPointerCapture
  HTMLElement.prototype.releasePointerCapture = originalReleasePointerCapture
})

/** Drags the handle from one Y position to another. */
const drag = (fromY: number, toY: number, { release = true } = {}) => {
  fireEvent.pointerDown(handle(), { clientY: fromY, pointerId: 1 })
  fireEvent.pointerMove(handle(), { clientY: toY, pointerId: 1 })
  if (release) {
    fireEvent.pointerUp(handle(), { clientY: toY, pointerId: 1 })
  }
}

describe("useVerticalResizeHandle", () => {
  it("starts at the initial height and publishes the bounds for screen readers", () => {
    render(<Resizable />)

    expect(height()).toBe("360")
    expect(handle().getAttribute("aria-valuenow")).toBe(String(INITIAL))
    expect(handle().getAttribute("aria-valuemin")).toBe(String(MIN))
    expect(handle().getAttribute("aria-valuemax")).toBe(String(MAX))
  })

  it("grows and shrinks by how far the pointer moved", () => {
    render(<Resizable />)

    drag(100, 200)
    expect(height()).toBe("460")

    drag(200, 150)
    expect(height()).toBe("410")
  })

  it("keeps following the pointer during a drag, not just at its end", () => {
    render(<Resizable />)

    drag(100, 200, { release: false })
    expect(height()).toBe("460")
    fireEvent.pointerMove(handle(), { clientY: 300, pointerId: 1 })
    expect(height()).toBe("560")
  })

  it("ignores pointer movement that is not part of a drag", () => {
    render(<Resizable />)

    fireEvent.pointerMove(handle(), { clientY: 900, pointerId: 1 })

    expect(height()).toBe("360")
  })

  it("stops resizing once the drag is released", () => {
    render(<Resizable />)

    drag(100, 200)
    fireEvent.pointerMove(handle(), { clientY: 800, pointerId: 1 })

    expect(height()).toBe("460")
  })

  it("takes focus on a pointer press, so the arrow keys reach it afterwards", () => {
    render(<Resizable />)

    fireEvent.pointerDown(handle(), { clientY: 100, pointerId: 1 })

    expect(document.activeElement).toBe(handle())
  })

  it("is reachable by keyboard and resizes a step at a time", () => {
    render(<Resizable />)

    expect(handle().getAttribute("tabindex")).toBe("0")

    fireEvent.keyDown(handle(), { key: "ArrowDown" })
    expect(height()).toBe(String(INITIAL + STEP))

    fireEvent.keyDown(handle(), { key: "ArrowUp" })
    expect(height()).toBe(String(INITIAL))
  })

  it("leaves other keys to the page, so nothing else is swallowed", () => {
    render(<Resizable />)

    const event = fireEvent.keyDown(handle(), { key: "Tab" })

    expect(height()).toBe("360")
    // fireEvent returns false when the handler called preventDefault.
    expect(event).toBe(true)
  })

  it("stops the arrow keys from scrolling the page behind the handle", () => {
    render(<Resizable />)

    expect(fireEvent.keyDown(handle(), { key: "ArrowDown" })).toBe(false)
  })

  it("will not shrink below the minimum, by drag or by key", () => {
    render(<Resizable />)

    drag(500, 0)
    expect(height()).toBe(String(MIN))

    fireEvent.keyDown(handle(), { key: "ArrowUp" })
    expect(height()).toBe(String(MIN))
  })

  it("will not grow past the maximum, by drag or by key", () => {
    render(<Resizable />)

    drag(0, 2000)
    expect(height()).toBe(String(MAX))

    fireEvent.keyDown(handle(), { key: "ArrowDown" })
    expect(height()).toBe(String(MAX))
  })
})
