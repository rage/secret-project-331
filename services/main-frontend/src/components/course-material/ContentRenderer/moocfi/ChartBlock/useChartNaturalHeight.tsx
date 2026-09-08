"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface ChartNaturalHeight {
  /** Attach to the element wrapping the rendered chart. */
  chartRef: (node: HTMLDivElement | null) => void
  /** The chart's own layout height in px; null until it has rendered and been measured. */
  naturalHeightPx: number | null
}

/**
 * Measures the height the chart renders at, ignoring any CSS scale applied on top of it.
 *
 * Vega renders asynchronously (and again once the remote data loads), so the chart is watched for
 * size changes rather than measured once. Multi-view specs render at their intrinsic size rather
 * than the container's, which is why measuring is the only way to know how tall they really are.
 *
 * @param debounceMs how long resizing must pause before the chart is remeasured
 */
export const useChartNaturalHeight = (debounceMs: number): ChartNaturalHeight => {
  const [naturalHeightPx, setNaturalHeightPx] = useState<number | null>(null)
  const lastReportedRef = useRef<number | null>(null)
  const observerRef = useRef<ResizeObserver | undefined>(undefined)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Callback ref: (re)attach the observer as the chart node mounts and unmounts.
  const chartRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect()
      if (!node) {
        return
      }
      const measure = () => {
        // offsetHeight is the layout height, unaffected by the CSS scale applied for sizing, so it
        // always reflects the chart's true height.
        const measured = node.offsetHeight
        if (measured > 0 && measured !== lastReportedRef.current) {
          lastReportedRef.current = measured
          setNaturalHeightPx(measured)
        }
      }
      const observer = new ResizeObserver(() => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
        }
        debounceRef.current = setTimeout(measure, debounceMs)
      })
      observer.observe(node)
      observerRef.current = observer
      measure()
    },
    [debounceMs],
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

  return { chartRef, naturalHeightPx }
}
