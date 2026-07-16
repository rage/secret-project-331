"use client"

import { css, cx } from "@emotion/css"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import type { ColumnDef, OnChangeFn, SortingState } from "@tanstack/react-table"
import { useWindowVirtualizer } from "@tanstack/react-virtual"
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

import { colorPairs } from "./studentsTableColors"
import {
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

interface ColMeta {
  minWidth?: number
}

function getMeta<T extends object>(colDef: ColumnDef<T, unknown> | undefined): ColMeta | undefined {
  return (colDef as ColumnDef<T, unknown> & { meta?: ColMeta })?.meta
}

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
  columns: ColumnDef<T, unknown>[]
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

  const table = useReactTable({
    columns,
    data,
    state: { sorting: sorting ?? [] },
    // Omitted when undefined to satisfy exactOptionalPropertyTypes.
    ...(onSortingChange ? { onSortingChange } : {}),
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
  })

  const rows = table.getRowModel().rows
  const leafCount = table.getVisibleLeafColumns().length

  // No longer a scroll container: rows virtualize against the window's scroll position, so this
  // ref is only a measurement anchor (offsetTop for scrollMargin, getBoundingClientRect for the
  // floating header).
  const tableWrapperRef = useRef<HTMLDivElement | null>(null)
  const scrollMarginRef = useRef(0)
  const [, forceRemeasure] = useState(0)

  useLayoutEffect(() => {
    scrollMarginRef.current = tableWrapperRef.current?.offsetTop ?? 0
    // Bump state so useWindowVirtualizer picks up the freshly measured scrollMargin on this same
    // paint, instead of waiting for the next scroll event.
    forceRemeasure((n) => n + 1)
  }, [data])

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

  const [showFloatingHeader, setShowFloatingHeader] = useState(false)
  const [floatingRect, setFloatingRect] = useState({ left: 0, width: 0 })
  const [headerMeasurements, setHeaderMeasurements] = useState<{
    widths: Record<string, number>
    tableWidth: number
  }>({ widths: {}, tableWidth: 0 })

  const measureHeader = useCallback(() => {
    const theadEl = theadRef.current
    const tableEl = realTableRef.current
    if (!theadEl || !tableEl) {
      return
    }
    const widths: Record<string, number> = {}
    theadEl.querySelectorAll<HTMLTableCellElement>("th[data-header-id]").forEach((th) => {
      const id = th.getAttribute("data-header-id")
      if (id) {
        widths[id] = th.getBoundingClientRect().width
      }
    })
    setHeaderMeasurements({ widths, tableWidth: tableEl.getBoundingClientRect().width })
  }, [])

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
    if (!wrapper || !theadEl) {
      return
    }
    const rect = wrapper.getBoundingClientRect()
    const headerHeight = theadEl.getBoundingClientRect().height
    setShowFloatingHeader(rect.top < 0 && rect.bottom > headerHeight)
  }, [])

  // Re-measure header cell widths whenever the rendered content could change column widths, and
  // re-check pin state since a shorter/taller page can push the table above/below the threshold.
  useLayoutEffect(() => {
    measureHeader()
    updateShowFloatingHeader()
  }, [data, columns, measureHeader, updateShowFloatingHeader])

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
    measureFloatingRect()
    measureHeader()
    updateShowFloatingHeader()

    const wrapper = tableWrapperRef.current
    horizontalScrollElRef.current =
      wrapper?.closest<HTMLElement>("[data-students-horizontal-scroll]") ?? null

    const onWindowScroll = () => updateShowFloatingHeader()
    window.addEventListener("scroll", onWindowScroll, { passive: true })

    const onWindowResize = () => {
      measureFloatingRect()
      measureHeader()
      scrollMarginRef.current = tableWrapperRef.current?.offsetTop ?? 0
    }
    window.addEventListener("resize", onWindowResize)

    const ro = new ResizeObserver(() => {
      measureFloatingRect()
      measureHeader()
      scrollMarginRef.current = tableWrapperRef.current?.offsetTop ?? 0
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
    }
  }, [measureFloatingRect, measureHeader, updateShowFloatingHeader])

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
              const measuredWidth = headerMeasurements.widths[header.id]

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
                  /* oxlint-disable-next-line react/forbid-dom-props -- freezes the floating
                  header's column widths to match the real (measured) header so they stay
                  pixel-aligned. */
                  style={
                    floating && typeof measuredWidth === "number"
                      ? { width: measuredWidth, minWidth: measuredWidth, maxWidth: measuredWidth }
                      : undefined
                  }
                  className={cx(
                    thStyle,
                    canSort && sortableThCss,
                    removeRight && noRightBorder,
                    removeLeft && noLeftBorder,
                    (() => {
                      const minW = getMeta<T>(header.column?.columnDef)?.minWidth ?? 80
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
                        min-width: ${minW}px;
                        width: auto;
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
                  const meta = getMeta<T>(cell.column.columnDef)
                  const minW = typeof meta?.minWidth === "number" ? meta.minWidth : undefined
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
                      width: auto;
                      ${typeof minW === "number" ? `min-width: ${minW}px;` : ""}
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
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
            <table className={tableStyle} style={{ width: headerMeasurements.tableWidth }}>
              {renderTableHead(true)}
            </table>
          </div>
        </div>
      )}
      <table className={tableStyle} ref={realTableRef}>
        {renderTableHead(false)}
        {renderTableBody()}
      </table>
    </div>
  )
}
