"use client"

import { css, cx } from "@emotion/css"
import { flexRender, useTable } from "@tanstack/react-table"
import type { ColumnDef, OnChangeFn, Row, SortingState } from "@tanstack/react-table"
import { useWindowVirtualizer } from "@tanstack/react-virtual"
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

import { ColumnResizeHandle } from "./ColumnResizeHandle"
import {
  distributeGroupWidth,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  preserveUserWidths,
  stretchToFill,
} from "./columnWidths"
import { colorPairs } from "./studentsTableColors"
import { studentsTableFeatures, type StudentsTableFeatures } from "./studentsTableFeatures"
import {
  cellTruncateCss,
  floatingHeaderInnerCss,
  floatingHeaderShellCss,
  floatingHeaderShellDynamic,
  headerRowStyle,
  headerUnderlineCss,
  lastRowTdStyle,
  noLeftBorder,
  noRightBorder,
  PAD,
  rowStyle,
  sortableThCss,
  tableEmptyCell,
  tableStyle,
  tableViewportCss,
  tdStyle,
  thStyle,
} from "./studentsTableStyles"
import {
  type MeasurableGroupHeader,
  type MeasurableLeafColumn,
  useMeasuredColumnWidths,
} from "./useMeasuredColumnWidths"

// Estimated row height (px) used by the virtualizer before real rows are measured.
const ESTIMATED_ROW_HEIGHT = 50

// Spacer rows reserve the scroll height of off-screen rows. Inline style (not Emotion `css`) so the
// per-frame height does not leak a new class into Emotion's never-evicted cache.
const spacerCellStyle = (height: number): React.CSSProperties => ({
  height,
  padding: 0,
  border: 0,
})

interface StudentsTableProps<T extends object> {
  columns: ColumnDef<StudentsTableFeatures, T, unknown>[]
  data: T[]
  colorHeaders?: boolean
  colorColumns?: boolean
  colorHeaderUnderline?: boolean
  progressMode?: boolean
  /** Controlled sort state; column ids are the server sort keys. Sorting/filtering happen server-side. */
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
}

/**
 * Sticky-header, row-virtualized table shared by every students subtab. Sorting is controlled and
 * applied server-side (`manualSorting`); the data arrives pre-sorted and pre-filtered. The header
 * stays pinned while the body scrolls inside the viewport, so it works for long student lists.
 */
export function StudentsTable<T extends object>({
  columns,
  data,
  colorHeaders = false,
  colorColumns = false,
  colorHeaderUnderline = false,
  progressMode = false,
  sorting,
  onSortingChange,
}: StudentsTableProps<T>) {
  const { t } = useTranslation()

  // Column-coloring offsets differ per layout. Progress: Student + a 2-wide "Total" group before the
  // colored chapter groups (groups from index 2, cells from index 3). Completions: only Student before
  // its colored module groups (index 1).
  const chapterHeaderStart = progressMode ? 2 : 1 // upper headers (groups) start index
  const subHeaderStart = progressMode ? 3 : 1 // lower headers / leaf cells start index

  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({})
  // Columns the user dragged, so a re-measure does not undo their width.
  const userResizedRef = useRef<Set<string>>(new Set())
  const measuredWidthsRef = useRef<Record<string, number>>({})

  const table = useTable({
    features: studentsTableFeatures,
    columns,
    data,
    state: { sorting: sorting ?? [], columnSizing },
    onColumnSizingChange: setColumnSizing,
    // Omitted when undefined to satisfy exactOptionalPropertyTypes.
    ...(onSortingChange ? { onSortingChange } : {}),
    manualSorting: true,
    enableSortingRemoval: false,
    defaultColumn: { minSize: MIN_COLUMN_WIDTH },
  })

  const rows = table.getRowModel().rows
  const leafCount = table.getVisibleLeafColumns().length

  // No longer a scroll container: rows virtualize against the window's scroll position, so this
  // ref is only a measurement anchor (offsetTop for scrollMargin, getBoundingClientRect for the
  // floating header).
  const tableWrapperRef = useRef<HTMLDivElement | null>(null)
  const scrollMarginRef = useRef(0)
  const [, forceRemeasure] = useState(0)

  const measureScrollMargin = useCallback(() => {
    const wrapper = tableWrapperRef.current
    // Document-absolute top (getBoundingClientRect + scrollY), not offsetTop: the window virtualizer
    // measures from the document top, but offsetTop is relative to the nearest positioned ancestor
    // (layout.tsx's position: relative BreakFromCentered), which would place virtualized rows too high.
    scrollMarginRef.current = wrapper ? wrapper.getBoundingClientRect().top + window.scrollY : 0
  }, [])

  useLayoutEffect(() => {
    measureScrollMargin()
    // Bump state so useWindowVirtualizer picks up the freshly measured scrollMargin on this same
    // paint, instead of waiting for the next scroll event.
    forceRemeasure((n) => n + 1)
  }, [data, measureScrollMargin])

  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 12,
    scrollMargin: scrollMarginRef.current,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const scrollMargin = rowVirtualizer.options.scrollMargin
  const paddingTop = (virtualItems[0]?.start ?? 0) - scrollMargin
  const lastVirtualItem = virtualItems[virtualItems.length - 1]
  // getTotalSize() already has scrollMargin subtracted out (it's the list's local size), while
  // virtualItem.start/.end are document-absolute (they include scrollMargin) -- add scrollMargin
  // back so both sides of the subtraction are in the same (local) coordinate space.
  const paddingBottom = lastVirtualItem
    ? rowVirtualizer.getTotalSize() + scrollMargin - lastVirtualItem.end
    : 0

  // Floating header: a second copy of the <thead>, rendered from the same react-table state so
  // sort/ARIA state can never drift out of sync, shown as position: fixed once the real header
  // scrolls above the viewport. Needed because tableSection (layout.tsx) keeps overflow-x: auto
  // for wide-table horizontal scroll on narrow viewports, and CSS auto-promotes overflow-y to
  // auto whenever overflow-x isn't visible -- which would silently break a plain CSS
  // `position: sticky` header's ability to track the *window's* scroll instead of that
  // ancestor's (permanently-zero) scroll offset.
  const realTableRef = useRef<HTMLTableElement | null>(null)
  const theadRef = useRef<HTMLTableSectionElement | null>(null)
  const floatingInnerRef = useRef<HTMLDivElement | null>(null)
  const horizontalScrollElRef = useRef<HTMLElement | null>(null)
  const horizontalRafRef = useRef<number | null>(null)
  const showHeaderRafRef = useRef<number | null>(null)

  const [showFloatingHeader, setShowFloatingHeader] = useState(false)
  const [floatingRect, setFloatingRect] = useState({ left: 0, width: 0 })
  // Unpinning mid-drag would unmount the very handle being dragged, so pinning is frozen until the
  // gesture ends.
  const isResizingRef = useRef(false)

  const measureFloatingRect = useCallback(() => {
    const wrapper = tableWrapperRef.current
    if (!wrapper) {
      return
    }
    const rect = wrapper.getBoundingClientRect()
    setFloatingRect({ left: rect.left, width: rect.width })
  }, [])

  const updateShowFloatingHeader = useCallback(() => {
    const wrapper = tableWrapperRef.current
    const theadEl = theadRef.current
    if (!wrapper || !theadEl || isResizingRef.current) {
      return
    }
    const rect = wrapper.getBoundingClientRect()
    const headerHeight = theadEl.getBoundingClientRect().height
    setShowFloatingHeader(rect.top < 0 && rect.bottom > headerHeight)
  }, [])

  // A shorter or taller page can push the table above or below the pin threshold.
  useLayoutEffect(() => {
    updateShowFloatingHeader()
  }, [data, columns, updateShowFloatingHeader])

  // The floating header's inner wrapper is a fresh DOM node each time it mounts (it only exists
  // while showFloatingHeader is true), so it starts untransformed -- sync it to the current
  // horizontal scroll position immediately, otherwise it renders misaligned until the next
  // horizontal scroll event.
  useLayoutEffect(() => {
    if (showFloatingHeader && floatingInnerRef.current) {
      const x = horizontalScrollElRef.current?.scrollLeft ?? 0
      floatingInnerRef.current.style.transform = `translateX(-${x}px)`
    }
  }, [showFloatingHeader])

  useEffect(() => {
    // Pin state is already resolved before paint by the useLayoutEffect above (on mount and on
    // every data/columns change); only the floating rect is measured here.
    measureFloatingRect()

    const wrapper = tableWrapperRef.current
    horizontalScrollElRef.current =
      wrapper?.closest<HTMLElement>("[data-students-horizontal-scroll]") ?? null

    // rAF-throttle the pin check so a scroll burst does at most one pair of layout reads per frame,
    // matching the horizontal-scroll handler below.
    const onWindowScroll = () => {
      if (showHeaderRafRef.current !== null) {
        return
      }
      showHeaderRafRef.current = requestAnimationFrame(() => {
        showHeaderRafRef.current = null
        updateShowFloatingHeader()
      })
    }
    window.addEventListener("scroll", onWindowScroll, { passive: true })

    const onWindowResize = () => {
      measureFloatingRect()
      measureScrollMargin()
    }
    window.addEventListener("resize", onWindowResize)

    const ro = new ResizeObserver(() => {
      measureFloatingRect()
      measureScrollMargin()
    })
    if (wrapper) {
      ro.observe(wrapper)
    }

    const applyHorizontalTransform = (x: number) => {
      if (floatingInnerRef.current) {
        floatingInnerRef.current.style.transform = `translateX(-${x}px)`
      }
    }
    const onHorizontalScroll = () => {
      if (horizontalRafRef.current !== null) {
        return
      }
      horizontalRafRef.current = requestAnimationFrame(() => {
        horizontalRafRef.current = null
        applyHorizontalTransform(horizontalScrollElRef.current?.scrollLeft ?? 0)
      })
    }
    const horizontalScrollEl = horizontalScrollElRef.current
    horizontalScrollEl?.addEventListener("scroll", onHorizontalScroll, { passive: true })
    applyHorizontalTransform(horizontalScrollEl?.scrollLeft ?? 0)

    return () => {
      window.removeEventListener("scroll", onWindowScroll)
      window.removeEventListener("resize", onWindowResize)
      ro.disconnect()
      horizontalScrollEl?.removeEventListener("scroll", onHorizontalScroll)
      if (horizontalRafRef.current !== null) {
        cancelAnimationFrame(horizontalRafRef.current)
      }
      if (showHeaderRafRef.current !== null) {
        cancelAnimationFrame(showHeaderRafRef.current)
      }
    }
  }, [measureFloatingRect, measureScrollMargin, updateShowFloatingHeader])

  // Plain-text stand-in for a cell, so widths can be measured without mounting 1000 rows. Columns
  // whose cell renders elements supply it through meta.measureValue.
  const getCellText = useCallback(
    (row: Row<StudentsTableFeatures, T>, columnId: string): string => {
      const column = table.getColumn(columnId)
      const measureValue = column?.columnDef.meta?.measureValue
      if (measureValue) {
        return measureValue(row.original as never)
      }
      if (!column?.accessorFn) {
        return ""
      }
      const value = row.getValue(columnId)
      return value === null || value === undefined ? "" : String(value)
    },
    [table],
  )

  const leafColumnsForMeasurement = useMemo<MeasurableLeafColumn[]>(
    () =>
      table.getVisibleLeafColumns().map((column) => ({
        columnId: column.id,
        headerText: typeof column.columnDef.header === "string" ? column.columnDef.header : null,
        minWidth: column.columnDef.minSize ?? MIN_COLUMN_WIDTH,
        cellTexts: rows.map((row) => getCellText(row, column.id)),
        extraPx: column.columnDef.meta?.measureExtraPx ?? 0,
      })),
    [table, rows, getCellText],
  )

  const groupHeadersForMeasurement = useMemo<MeasurableGroupHeader[]>(
    () =>
      table
        .getHeaderGroups()
        .flatMap((headerGroup) => headerGroup.headers)
        .filter((header) => header.subHeaders.length > 0)
        .flatMap((header) =>
          typeof header.column.columnDef.header === "string"
            ? [
                {
                  labelText: header.column.columnDef.header,
                  leafColumnIds: header.getLeafHeaders().map((leaf) => leaf.column.id),
                },
              ]
            : [],
        ),
    [table],
  )

  const { widths: measuredWidths, measureCellWidth } = useMeasuredColumnWidths({
    leafColumns: leafColumnsForMeasurement,
    groupHeaders: groupHeadersForMeasurement,
    containerRef: tableWrapperRef,
    enabled: true,
  })

  useEffect(() => {
    if (Object.keys(measuredWidths).length === 0) {
      return
    }
    measuredWidthsRef.current = measuredWidths
    setColumnSizing((previous) => {
      const next = preserveUserWidths(measuredWidths, previous, userResizedRef.current)
      const keys = Object.keys(next)
      const unchanged =
        keys.length === Object.keys(previous).length &&
        keys.every((key) => next[key] === previous[key])
      return unchanged ? previous : next
    })
  }, [measuredWidths])

  // Only cells that cannot fit get a tooltip; a dense table of short numbers should not sprout one
  // on every hover.
  const truncatedTitleFor = useCallback(
    (columnId: string, rowIndex: number): string | undefined => {
      const row = rows[rowIndex]
      if (!row) {
        return undefined
      }
      const text = getCellText(row, columnId)
      if (!text) {
        return undefined
      }
      const width = measureCellWidth(text)
      const columnWidth = table.getColumn(columnId)?.getSize()
      if (width === null || columnWidth === undefined || width <= columnWidth) {
        return undefined
      }
      return text
    },
    [rows, getCellText, measureCellWidth, table],
  )

  // A leaf column resolves to itself, so leaf and grouped headers share one set of resize handlers.
  const resizeTargetsOf = useCallback(
    (columnId: string) =>
      (table.getColumn(columnId)?.getLeafColumns() ?? []).map((column) => ({
        columnId: column.id,
        minWidth: Math.max(column.columnDef.minSize ?? MIN_COLUMN_WIDTH, MIN_COLUMN_WIDTH),
      })),
    [table],
  )

  const getColumnWidth = useCallback(
    (columnId: string) => {
      const leaves = table.getColumn(columnId)?.getLeafColumns() ?? []
      return leaves.length === 0
        ? MIN_COLUMN_WIDTH
        : leaves.reduce((total, leaf) => total + leaf.getSize(), 0)
    },
    [table],
  )

  const handleResizeStart = useCallback(() => {
    isResizingRef.current = true
  }, [])

  const handleResize = useCallback(
    (columnId: string, width: number) => {
      const targets = resizeTargetsOf(columnId)
      for (const target of targets) {
        userResizedRef.current.add(target.columnId)
      }
      setColumnSizing((previous) =>
        targets.length === 1 && targets[0]
          ? { ...previous, [targets[0].columnId]: width }
          : distributeGroupWidth(previous, targets, width),
      )
    },
    [resizeTargetsOf],
  )

  // A drag that narrows the table would otherwise leave a gap at its right edge; the columns the
  // user has not touched absorb it, so their own widths survive the refill.
  const refillTrailingSpace = useCallback(() => {
    const container = tableWrapperRef.current
    if (!container) {
      return
    }
    setColumnSizing((previous) => {
      const flexibleIds = table
        .getVisibleLeafColumns()
        .map((column) => column.id)
        .filter((id) => !userResizedRef.current.has(id) && previous[id] !== undefined)
      if (flexibleIds.length === 0) {
        return previous
      }
      const pinnedWidth = table
        .getVisibleLeafColumns()
        .filter((column) => !flexibleIds.includes(column.id))
        .reduce((total, column) => total + column.getSize(), 0)
      const next = stretchToFill(previous, flexibleIds, container.clientWidth - pinnedWidth)
      return flexibleIds.every((id) => next[id] === previous[id]) ? previous : next
    })
  }, [table])

  const handleResizeEnd = useCallback(() => {
    isResizingRef.current = false
    refillTrailingSpace()
    updateShowFloatingHeader()
  }, [refillTrailingSpace, updateShowFloatingHeader])

  const handleResizeReset = useCallback(
    (columnId: string) => {
      setColumnSizing((previous) => {
        const next = { ...previous }
        for (const { columnId: leafId } of resizeTargetsOf(columnId)) {
          userResizedRef.current.delete(leafId)
          const measured = measuredWidthsRef.current[leafId]
          if (measured !== undefined) {
            next[leafId] = measured
          }
        }
        return next
      })
    },
    [resizeTargetsOf],
  )

  interface HeaderBgArg {
    colSpan: number
  }

  const getHeaderBg = useCallback(
    (headerRow: number, colIdx: number, header: HeaderBgArg): string | undefined => {
      if (!colorHeaders) {
        return undefined
      }
      // Upper header groups
      if (headerRow === 0 && colIdx >= chapterHeaderStart && header.colSpan === 2) {
        const chapterIdx = colIdx - chapterHeaderStart
        return colorPairs[chapterIdx % colorPairs.length]?.[0]
      }
      // Lower header (points/attempts)
      if (headerRow === 1 && colIdx >= subHeaderStart && header.colSpan === 1) {
        const pairIdx = Math.floor((colIdx - subHeaderStart) / 2)
        const subIdx = (colIdx - subHeaderStart) % 2
        return colorPairs[pairIdx % colorPairs.length]?.[subIdx]
      }
      return undefined
    },
    [colorHeaders, chapterHeaderStart, subHeaderStart],
  )

  const headerGroups = table.getHeaderGroups()
  const headerRowCount = headerGroups.length
  const hasSizedColumns = Object.keys(columnSizing).length > 0

  // Both tables size from this one state, so the pinned clone cannot drift out of alignment.
  const renderColGroup = () => (
    <colgroup>
      {table.getVisibleLeafColumns().map((column) => (
        /* oxlint-disable-next-line react/forbid-dom-props -- a per-column pixel width; an Emotion
        class per value would leak into the never-evicted style cache. */
        <col key={column.id} style={{ width: column.getSize() }} />
      ))}
    </colgroup>
  )

  const renderTableHead = (floating: boolean) => (
    <thead ref={floating ? undefined : theadRef}>
      {headerGroups.map((headerGroup, rowIdx) => {
        let chapterCount = 0
        return (
          <tr key={headerGroup.id} className={headerRowStyle}>
            {headerGroup.headers.map((header, colIdx) => {
              // react-table repeats a top-level leaf column (e.g. Student) in every header row
              // (placeholder + real cell). Render it once in the first row spanning all rows, and
              // skip the rest, so the columnheader is not exposed twice to assistive tech.
              const isTopLevelLeaf = !header.column.parent && header.column.columns.length === 0
              if (rowIdx > 0 && isTopLevelLeaf) {
                return null
              }

              let removeRight = false
              let removeLeft = false
              // Drop the border between paired points/attempts subcolumns.
              if (progressMode && rowIdx === 1 && colIdx === 1) {
                removeRight = true
              }
              if (progressMode && rowIdx === 1 && colIdx === 2) {
                removeLeft = true
              }
              if (
                progressMode &&
                rowIdx === 1 &&
                colIdx >= subHeaderStart &&
                (colIdx - subHeaderStart) % 2 === 0
              ) {
                removeRight = true
              }
              if (
                progressMode &&
                rowIdx === 1 &&
                colIdx >= subHeaderStart &&
                (colIdx - subHeaderStart) % 2 === 1
              ) {
                removeLeft = true
              }

              let headerLabel = flexRender(header.column.columnDef.header, header.getContext())
              if (
                progressMode &&
                rowIdx === 0 &&
                colIdx >= chapterHeaderStart &&
                header.colSpan === 2
              ) {
                chapterCount += 1
                headerLabel = (
                  <span>
                    {chapterCount}: {headerLabel}
                  </span>
                )
              }

              const canSort = header.column.getCanSort()
              const sortDirection = header.column.getIsSorted()
              // `subHeaders` would miss a leaf that spans both header rows; getLeafColumns()
              // resolves a leaf to itself and a grouped header to the columns it spans, which is
              // exactly the set the handle resizes.
              const resizeTargets = header.column.getLeafColumns()
              const canResize =
                resizeTargets.length > 0 && resizeTargets.every((column) => column.getCanResize())

              return (
                <th
                  key={header.id}
                  data-header-id={header.id}
                  aria-sort={
                    sortDirection === "asc"
                      ? "ascending"
                      : sortDirection === "desc"
                        ? "descending"
                        : canSort
                          ? "none"
                          : undefined
                  }
                  onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  onKeyDown={
                    !floating && canSort
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            header.column.toggleSorting()
                          }
                        }
                      : undefined
                  }
                  tabIndex={!floating && canSort ? 0 : undefined}
                  className={cx(
                    thStyle,
                    canSort && sortableThCss,
                    removeRight && noRightBorder,
                    removeLeft && noLeftBorder,
                    (() => {
                      const bg =
                        colorHeaders && !colorHeaderUnderline
                          ? getHeaderBg(rowIdx, colIdx, header)
                          : undefined
                      const needsPadTop =
                        colorHeaderUnderline &&
                        rowIdx === 0 &&
                        colIdx >= chapterHeaderStart &&
                        header.colSpan === 2
                      return css`
                        ${bg ? `background: ${bg};` : ""}
                        position: relative;
                        overflow: visible;
                        padding-left: 8px;
                        padding-right: 8px;
                        ${needsPadTop ? `padding-top: 6px;` : ""}

                        ${respondToOrLarger.md} {
                          padding-left: 16px;
                          padding-right: 16px;
                          ${needsPadTop ? `padding-top: 8px;` : ""}
                        }

                        ${respondToOrLarger.lg} {
                          padding-left: 16px;
                          padding-right: 16px;
                          ${needsPadTop ? `padding-top: 10px;` : ""}
                        }
                      `
                    })(),
                  )}
                  rowSpan={isTopLevelLeaf && headerRowCount > 1 ? headerRowCount : undefined}
                  colSpan={header.colSpan > 1 ? header.colSpan : undefined}
                >
                  {headerLabel}
                  {canSort && (
                    <span aria-hidden="true">
                      {/* oxlint-disable-next-line i18next/no-literal-string */}
                      {sortDirection === "asc" ? " ▲" : sortDirection === "desc" ? " ▼" : " ⇅"}
                    </span>
                  )}

                  {colorHeaderUnderline &&
                    rowIdx === 0 &&
                    colIdx >= chapterHeaderStart &&
                    header.colSpan === 2 && (
                      <span
                        className={cx(
                          headerUnderlineCss,
                          css`
                            background: ${getHeaderBg(rowIdx, colIdx, header)};
                          `,
                        )}
                      />
                    )}
                  {canResize && (
                    <ColumnResizeHandle
                      columnId={header.column.id}
                      getWidth={getColumnWidth}
                      minWidth={resizeTargets.reduce(
                        (total, column) =>
                          total +
                          Math.max(column.columnDef.minSize ?? MIN_COLUMN_WIDTH, MIN_COLUMN_WIDTH),
                        0,
                      )}
                      maxWidth={resizeTargets.length * MAX_COLUMN_WIDTH}
                      label={t("label-resize-column", {
                        column:
                          typeof header.column.columnDef.header === "string"
                            ? header.column.columnDef.header
                            : header.column.id,
                      })}
                      presentational={floating}
                      onResizeStart={handleResizeStart}
                      onResize={handleResize}
                      onResizeEnd={handleResizeEnd}
                      onReset={handleResizeReset}
                    />
                  )}
                </th>
              )
            })}
          </tr>
        )
      })}
    </thead>
  )

  const renderRow = (rowIndex: number) => {
    const row = rows[rowIndex]
    if (!row) {
      return null
    }
    const isLast = rowIndex === rows.length - 1
    return (
      <tr
        key={row.id}
        data-index={rowIndex}
        ref={rowVirtualizer.measureElement}
        className={rowStyle}
      >
        {row.getVisibleCells().map((cell, i) => {
          let bg: string | undefined = undefined
          if (colorColumns && i >= subHeaderStart) {
            const pairIdx = Math.floor((i - subHeaderStart) / 2)
            const subIdx = (i - subHeaderStart) % 2
            bg = colorPairs[pairIdx % colorPairs.length]?.[subIdx]
          }

          let removeRight = false
          let removeLeft = false
          if (progressMode && i === 1) {
            removeRight = true
          }
          if (progressMode && i === 2) {
            removeLeft = true
          }
          if (progressMode && i >= subHeaderStart && (i - subHeaderStart) % 2 === 0) {
            removeRight = true
          }
          if (progressMode && i >= subHeaderStart && (i - subHeaderStart) % 2 === 1) {
            removeLeft = true
          }

          return (
            <td
              key={cell.id}
              className={cx(
                tdStyle,
                isLast && lastRowTdStyle,
                removeRight && noRightBorder,
                removeLeft && noLeftBorder,
                (() => {
                  const bgClass = bg
                    ? css`
                        background: ${bg};
                      `
                    : ""

                  if (cell.column.id === "actions") {
                    return cx(
                      bgClass,
                      css`
                        width: 60px;
                        min-width: 60px;
                        max-width: 60px;
                        padding-left: 2px;
                        padding-right: 2px;

                        ${respondToOrLarger.md} {
                          width: 70px;
                          min-width: 70px;
                          max-width: 70px;
                          padding-left: 4px;
                          padding-right: 4px;
                        }

                        ${respondToOrLarger.lg} {
                          width: 80px;
                          min-width: 80px;
                          max-width: 80px;
                        }
                      `,
                    )
                  }

                  return cx(
                    bgClass,
                    css`
                      padding-left: ${PAD}px;
                      padding-right: ${PAD}px;

                      ${respondToOrLarger.md} {
                        padding-left: 12px;
                        padding-right: 12px;
                      }

                      ${respondToOrLarger.lg} {
                        padding-left: 16px;
                        padding-right: 16px;
                      }
                    `,
                  )
                })(),
              )}
            >
              <div className={cellTruncateCss} title={truncatedTitleFor(cell.column.id, rowIndex)}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            </td>
          )
        })}
      </tr>
    )
  }

  const renderTableBody = () => {
    if (rows.length === 0) {
      return (
        <tbody>
          <tr>
            <td colSpan={leafCount} className={tableEmptyCell}>
              {t("no-results-found")}
            </td>
          </tr>
        </tbody>
      )
    }
    return (
      <tbody>
        {paddingTop > 0 && (
          <tr aria-hidden="true">
            {/* oxlint-disable-next-line react/forbid-dom-props -- dynamic per-scroll-frame height; a
            new Emotion class per height would leak into the never-evicted style cache. */}
            <td colSpan={leafCount} aria-hidden="true" style={spacerCellStyle(paddingTop)} />
          </tr>
        )}
        {virtualItems.map((virtualItem) => renderRow(virtualItem.index))}
        {paddingBottom > 0 && (
          <tr aria-hidden="true">
            {/* oxlint-disable-next-line react/forbid-dom-props -- dynamic per-scroll-frame height; a
            new Emotion class per height would leak into the never-evicted style cache. */}
            <td colSpan={leafCount} aria-hidden="true" style={spacerCellStyle(paddingBottom)} />
          </tr>
        )}
      </tbody>
    )
  }

  return (
    <div className={tableViewportCss} ref={tableWrapperRef}>
      {showFloatingHeader && (
        <div
          aria-hidden="true"
          className={cx(
            floatingHeaderShellCss,
            floatingHeaderShellDynamic(floatingRect.left, floatingRect.width),
          )}
        >
          <div ref={floatingInnerRef} className={floatingHeaderInnerCss}>
            {/* oxlint-disable-next-line react/forbid-dom-props -- freezes the floating table's
            overall width to match the real (measured) table so columns stay pixel-aligned. */}
            <table className={tableStyle} style={{ width: table.getTotalSize() }}>
              {renderColGroup()}
              {renderTableHead(true)}
            </table>
          </div>
        </div>
      )}
      <table
        className={tableStyle}
        ref={realTableRef}
        /* oxlint-disable-next-line react/forbid-dom-props -- pins the table to the measured column
        total; left at 100% the fixed layout rescales the colgroup, so a drag moves the divider by
        less than the pointer travelled. */
        style={hasSizedColumns ? { width: table.getTotalSize() } : undefined}
      >
        {renderColGroup()}
        {renderTableHead(false)}
        {renderTableBody()}
      </table>
    </div>
  )
}
