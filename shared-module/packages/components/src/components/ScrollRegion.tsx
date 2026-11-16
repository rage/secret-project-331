"use client"

import React, { useEffect, useRef, useState } from "react"
import { useObjectRef } from "react-aria"

/** Which horizontal edges have content scrolled out of view. */
export interface ScrollOverflow {
  start: boolean
  end: boolean
}

export interface ScrollRegionProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "role" | "tabIndex" | "aria-label" | "aria-labelledby"
> {
  /** Region name while it overflows. Without a name it is only a tab stop, not a region. */
  label?: string | undefined
  labelledBy?: string | undefined
  onOverflowChange?: ((overflow: ScrollOverflow) => void) | undefined
}

/** A horizontal scroll container that is a tab stop and a named region only while it overflows. */
export const ScrollRegion = React.forwardRef<HTMLDivElement, ScrollRegionProps>(
  function ScrollRegion({ label, labelledBy, onOverflowChange, children, ...rest }, forwardedRef) {
    const ref = useObjectRef(forwardedRef)
    const [overflow, setOverflow] = useState<ScrollOverflow>({ start: false, end: false })
    const onOverflowChangeRef = useRef(onOverflowChange)

    useEffect(() => {
      onOverflowChangeRef.current = onOverflowChange
    })

    useEffect(() => {
      onOverflowChangeRef.current?.(overflow)
    }, [overflow])

    useEffect(() => {
      const scroller = ref.current
      if (scroller === null) {
        return
      }

      const measure = () => {
        // RTL counts `scrollLeft` down from zero, so the distance from the start is its magnitude.
        const fromStart = Math.abs(scroller.scrollLeft)
        const scrollable = scroller.scrollWidth - scroller.clientWidth
        setOverflow((previous) => {
          const start = fromStart > 1
          const end = scrollable - fromStart > 1
          return previous.start === start && previous.end === end ? previous : { start, end }
        })
      }

      measure()
      scroller.addEventListener("scroll", measure, { passive: true })
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
      observer?.observe(scroller)
      const content = scroller.firstElementChild
      if (content !== null) {
        observer?.observe(content)
      }

      return () => {
        scroller.removeEventListener("scroll", measure)
        observer?.disconnect()
      }
    }, [ref])

    const overflows = overflow.start || overflow.end
    const named = overflows && (label !== undefined || labelledBy !== undefined)

    return (
      <div
        {...rest}
        ref={ref}
        // Keyboard users need a tab stop to scroll sideways.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={overflows ? 0 : undefined}
        // oxlint-disable-next-line i18next/no-literal-string
        role={named ? "region" : undefined}
        aria-label={named && labelledBy === undefined ? label : undefined}
        aria-labelledby={named ? labelledBy : undefined}
      >
        {children}
      </div>
    )
  },
)
