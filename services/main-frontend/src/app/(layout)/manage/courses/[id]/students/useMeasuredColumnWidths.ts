"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import {
  applyGroupLabelDeficits,
  buildNaturalWidths,
  type GroupWidthInput,
  type LeafWidthInput,
  MIN_COLUMN_WIDTH,
  pickWidestCandidates,
  stretchToFill,
} from "./columnWidths"
import { measureTextWidth, resolveFontShorthand, resolveHorizontalChrome } from "./measureTextWidth"

/** Room for the sort glyph and the resize handle, which share the header cell with its label. */
const HEADER_AFFORDANCE_WIDTH = 28

export interface MeasurableLeafColumn {
  columnId: string
  /** Header text, or null where the header renders elements rather than a string. */
  headerText: string | null
  minWidth: number
  /** The text each row will render in this column. */
  cellTexts: string[]
  /** Non-text chrome in the cell, such as an avatar or a badge. */
  extraPx: number
}

export interface MeasurableGroupHeader {
  labelText: string
  leafColumnIds: string[]
}

interface UseMeasuredColumnWidthsArgs {
  leafColumns: MeasurableLeafColumn[]
  groupHeaders: MeasurableGroupHeader[]
  /** Wraps the table; supplies both the available width and the cells sampled for font and padding. */
  containerRef: React.RefObject<HTMLElement | null>
  enabled: boolean
}

interface MeasuredColumnWidths {
  /** Empty where text measurement is unavailable (jsdom); callers must leave the table unsized then. */
  widths: Record<string, number>
  /** Rendered width of body text, or null when it cannot be measured. */
  measureCellWidth: (text: string) => number | null
}

function sameWidths(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

interface TypeContext {
  headerFont: string
  bodyFont: string
  headerChrome: number
  bodyChrome: number
}

function readTypeContext(container: HTMLElement): TypeContext | null {
  const headerCell = container.querySelector("thead th")
  if (!headerCell) {
    return null
  }
  // Falls back to the header cell so a table with no rows can still size its headers.
  const bodyCell = container.querySelector("tbody td") ?? headerCell
  return {
    headerFont: resolveFontShorthand(headerCell),
    bodyFont: resolveFontShorthand(bodyCell),
    headerChrome: resolveHorizontalChrome(headerCell),
    bodyChrome: resolveHorizontalChrome(bodyCell),
  }
}

/** True once webfonts have settled; measuring earlier silently measures the fallback face. */
function useFontsReady(): boolean {
  const [ready, setReady] = useState(() => document.fonts?.status === "loaded")

  useEffect(() => {
    const fonts = document.fonts
    if (!fonts || ready) {
      return
    }
    let cancelled = false
    fonts.ready.then(
      () => {
        if (!cancelled) {
          setReady(true)
        }
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [ready])

  return ready
}

/**
 * Column widths derived from the data rather than from whichever rows happen to be mounted, so they
 * hold still while a virtualized body scrolls.
 *
 * Recomputed when the data, the columns or the container width change, never while scrolling. A
 * width change can also cross a breakpoint that alters font size and padding, so it remeasures
 * rather than only redistributing slack.
 */
export function useMeasuredColumnWidths({
  leafColumns,
  groupHeaders,
  containerRef,
  enabled,
}: UseMeasuredColumnWidthsArgs): MeasuredColumnWidths {
  const [widths, setWidths] = useState<Record<string, number>>({})
  const typeContextRef = useRef<TypeContext | null>(null)
  const fontsReady = useFontsReady()
  const lastContainerWidthRef = useRef(0)

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!enabled || !container || leafColumns.length === 0) {
      return
    }
    const typeContext = readTypeContext(container)
    if (!typeContext) {
      return
    }
    typeContextRef.current = typeContext
    const { headerFont, bodyFont, headerChrome, bodyChrome } = typeContext

    const leafInputs: LeafWidthInput[] = []
    for (const column of leafColumns) {
      let contentWidth = 0
      if (column.headerText !== null) {
        const headerWidth = measureTextWidth(column.headerText, headerFont)
        if (headerWidth === null) {
          return
        }
        contentWidth = headerWidth + headerChrome + HEADER_AFFORDANCE_WIDTH
      }
      for (const candidate of pickWidestCandidates(column.cellTexts)) {
        const measured = measureTextWidth(candidate, bodyFont)
        if (measured === null) {
          return
        }
        contentWidth = Math.max(contentWidth, measured + bodyChrome + column.extraPx)
      }
      leafInputs.push({
        columnId: column.columnId,
        contentWidth,
        minWidth: Math.max(column.minWidth, MIN_COLUMN_WIDTH),
      })
    }

    const groupInputs: GroupWidthInput[] = []
    for (const group of groupHeaders) {
      const labelWidth = measureTextWidth(group.labelText, headerFont)
      if (labelWidth === null) {
        return
      }
      groupInputs.push({
        labelWidth: labelWidth + headerChrome,
        leafColumnIds: group.leafColumnIds,
      })
    }

    const natural = applyGroupLabelDeficits(buildNaturalWidths(leafInputs), groupInputs)
    lastContainerWidthRef.current = container.clientWidth
    const next = stretchToFill(
      natural,
      leafColumns.map((column) => column.columnId),
      container.clientWidth,
    )
    // A fresh object every pass, and the inputs are rebuilt on every render, so committing
    // unconditionally would loop.
    setWidths((previous) => (sameWidths(previous, next) ? previous : next))
  }, [enabled, leafColumns, groupHeaders, containerRef])

  useLayoutEffect(() => {
    measure()
  }, [measure, fontsReady])

  useEffect(() => {
    const container = containerRef.current
    if (!enabled || !container) {
      return
    }
    const observer = new ResizeObserver(() => {
      if (container.clientWidth !== lastContainerWidthRef.current) {
        measure()
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [enabled, containerRef, measure])

  const measureCellWidth = useCallback((text: string) => {
    const typeContext = typeContextRef.current
    if (!typeContext) {
      return null
    }
    const width = measureTextWidth(text, typeContext.bodyFont)
    return width === null ? null : width + typeContext.bodyChrome
  }, [])

  return { widths, measureCellWidth }
}
