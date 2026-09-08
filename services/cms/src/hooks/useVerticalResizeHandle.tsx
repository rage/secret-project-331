"use client"

import React, { useRef, useState } from "react"

interface VerticalResizeHandleOptions {
  initialHeightPx: number
  minHeightPx: number
  maxHeightPx: number
  /** How much one arrow-key press changes the height by while the handle has focus. */
  keyboardStepPx: number
}

interface VerticalResizeHandleProps {
  tabIndex: number
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
  "aria-valuenow": number
  "aria-valuemin": number
  "aria-valuemax": number
}

/**
 * Height of a resizable area, driven by a handle the user drags or nudges with the arrow keys.
 *
 * The caller renders the handle itself (with a `role="separator"`, a label and the styling it
 * wants) and spreads `handleProps` onto it.
 *
 * @returns the current `heightPx`, and `handleProps` to spread onto the handle element
 */
export const useVerticalResizeHandle = ({
  initialHeightPx,
  minHeightPx,
  maxHeightPx,
  keyboardStepPx,
}: VerticalResizeHandleOptions): {
  heightPx: number
  handleProps: VerticalResizeHandleProps
} => {
  const [heightPx, setHeightPx] = useState(initialHeightPx)
  const drag = useRef<{ startY: number; startHeight: number } | null>(null)

  const clamp = (height: number) => Math.min(maxHeightPx, Math.max(minHeightPx, height))

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    // Focus explicitly: the arrow keys only reach the handle once it holds focus, and a plain
    // pointer press on a div doesn't focus it in every browser. Text selection is suppressed with
    // user-select rather than preventDefault, which would cancel focus altogether.
    event.currentTarget.focus()
    // Pointer capture keeps events flowing to the handle even as the cursor moves outside it.
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startY: event.clientY, startHeight: heightPx }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const started = drag.current
    if (!started) {
      return
    }
    setHeightPx(clamp(started.startHeight + (event.clientY - started.startY)))
  }

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const step =
      event.key === "ArrowDown" ? keyboardStepPx : event.key === "ArrowUp" ? -keyboardStepPx : 0
    if (step === 0) {
      return
    }
    // Keep the arrows on the handle instead of scrolling the page behind it.
    event.preventDefault()
    setHeightPx((current) => clamp(current + step))
  }

  return {
    heightPx,
    handleProps: {
      tabIndex: 0,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onKeyDown,
      "aria-valuenow": heightPx,
      "aria-valuemin": minHeightPx,
      "aria-valuemax": maxHeightPx,
    },
  }
}
