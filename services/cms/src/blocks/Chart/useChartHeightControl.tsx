"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { type Control, useForm } from "react-hook-form"

import { isMultiViewSpec, resolveChartLayout } from "./chartSpec"

interface ChartHeightControlOptions {
  spec: string
  /** The height stored on the block. */
  heightPx: number
  /** Whether that height is still the automatic one rather than one the teacher picked. */
  heightIsAuto: boolean
  minHeightPx: number
  /** Commits a height the teacher chose, already clamped and rounded. */
  onHeightChange: (heightPx: number) => void
}

interface ChartHeightControl {
  /** The height the block is displayed at, which for a scaled multi-view chart isn't `heightPx`. */
  boxHeightPx: number
  /** Pass to the number field that edits the height. */
  heightFieldControl: Control<{ height: string }>
  /** Pass to the preview so it can report the height the chart renders at on its own. */
  reportNaturalHeight: (heightPx: number) => void
  /** Commits a height from outside the field, such as a drag of the block's bottom edge. */
  commitHeight: (heightPx: number) => void
}

/**
 * The height the block displays at, together with the number field that edits it.
 *
 * A multi-view chart can't be sized through its spec, so it is scaled to fit instead and the
 * displayed height differs from the stored one. The field therefore mirrors the displayed height,
 * and only a real edit of it — not that mirroring — commits a new height.
 */
export const useChartHeightControl = ({
  spec,
  heightPx,
  heightIsAuto,
  minHeightPx,
  onHeightChange,
}: ChartHeightControlOptions): ChartHeightControl => {
  const [naturalHeightPx, setNaturalHeightPx] = useState<number | null>(null)

  const isMultiView = useMemo(() => {
    try {
      return isMultiViewSpec(JSON.parse(spec))
    } catch {
      return false
    }
  }, [spec])

  const { boxHeightPx } = resolveChartLayout({
    heightAttr: heightPx,
    heightIsAuto,
    naturalHeightPx,
    isMultiView,
  })

  const commitHeight = useCallback(
    (value: number) => onHeightChange(Math.max(minHeightPx, Math.round(value))),
    [minHeightPx, onHeightChange],
  )

  const { control, watch, getValues, setValue } = useForm<{ height: string }>({
    defaultValues: { height: String(boxHeightPx) },
  })

  useEffect(() => {
    if (String(boxHeightPx) !== getValues("height")) {
      setValue("height", String(boxHeightPx))
    }
  }, [boxHeightPx, getValues, setValue])

  // Re-subscribed every render so the callback never closes over a stale boxHeightPx.
  useEffect(() => {
    const subscription = watch((values, { name }) => {
      if (name !== "height") {
        return
      }
      const parsed = Math.trunc(Number(values.height))
      // Ignore the echo from mirroring boxHeightPx into the field; only commit real user edits.
      if (!Number.isNaN(parsed) && parsed >= minHeightPx && parsed !== boxHeightPx) {
        commitHeight(parsed)
      }
    })
    return () => subscription.unsubscribe()
  })

  return {
    boxHeightPx,
    heightFieldControl: control,
    reportNaturalHeight: setNaturalHeightPx,
    commitHeight,
  }
}
