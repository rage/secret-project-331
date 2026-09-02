"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface ChartNaturalSizeOptions {
  /** How long resizing must pause before the chart is remeasured. */
  debounceMs: number
  /** Reports every new natural height, for a caller that sizes its own box to match. */
  onHeightChange?: ((heightPx: number) => void) | undefined
}

interface ChartNaturalSize {
  /** Attach to the element wrapping the rendered chart. */
  chartRef: (node: HTMLDivElement | null) => void
  /** The chart's own layout height in px; null until it has rendered and been measured. */
  naturalHeightPx: number | null
  /** The chart's own layout width in px; null until it has rendered and been measured. */
  naturalWidthPx: number | null
}

/**
 * Measures the size the chart renders at, ignoring any CSS scale applied on top of it.
 *
 * Vega renders asynchronously (and again once the remote data loads), so the chart is watched for
 * size changes rather than measured once. Multi-view specs render at their intrinsic size rather
 * than the container's, which is why measuring is the only way to know how large they really are.
 */
export const useChartNaturalSize = ({
  debounceMs,
  onHeightChange,
}: ChartNaturalSizeOptions): ChartNaturalSize => {
  const [naturalHeightPx, setNaturalHeightPx] = useState<number | null>(null)
  const [naturalWidthPx, setNaturalWidthPx] = useState<number | null>(null)
  const lastReportedHeightRef = useRef<number | null>(null)
  const lastReportedWidthRef = useRef<number | null>(null)
  const observerRef = useRef<ResizeObserver | undefined>(undefined)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const measure = useCallback(
    (node: HTMLDivElement) => {
      // offsetHeight is the layout height, unaffected by a CSS scale, so it always reflects the
      // chart's true natural height.
      const measuredHeight = node.offsetHeight
      if (measuredHeight > 0 && measuredHeight !== lastReportedHeightRef.current) {
        lastReportedHeightRef.current = measuredHeight
        setNaturalHeightPx(measuredHeight)
        onHeightChange?.(measuredHeight)
      }
      // The SVG's own layout width, likewise unaffected by the scale — the chart's true width, and
      // so the width it would take on any viewport.
      const measuredWidth = node.querySelector("svg")?.clientWidth ?? 0
      if (measuredWidth > 0 && measuredWidth !== lastReportedWidthRef.current) {
        lastReportedWidthRef.current = measuredWidth
        setNaturalWidthPx(measuredWidth)
      }
    },
    [onHeightChange],
  )

  // Callback ref: (re)attach the observer as the chart node mounts and unmounts.
  const chartRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect()
      if (!node) {
        return
      }
      const observer = new ResizeObserver(() => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
        }
        debounceRef.current = setTimeout(() => measure(node), debounceMs)
      })
      observer.observe(node)
      observerRef.current = observer
      measure(node)
    },
    [measure, debounceMs],
  )

  useEffect(
    () => () => {
      observerRef.current?.disconnect()
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    },
    [],
  )

  return { chartRef, naturalHeightPx, naturalWidthPx }
}
