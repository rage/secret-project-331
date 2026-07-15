"use client"

import { css, cx } from "@emotion/css"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import type { ColumnDef, OnChangeFn, SortingState } from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import React, { useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"

import { colorPairs } from "./studentsTableColors"
import {
  headerRowStyle,
  headerUnderlineCss,
  lastRowTdStyle,
  noLeftBorder,
  noRightBorder,
  PAD,
  rowStyle,
  sortableThCss,
  stickyTheadCss,
  tableEmptyCell,
  tableStyle,
  tableViewportCss,
  tdStyle,
  thStyle,
} from "./studentsTableStyles"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface ColMeta {
  minWidth?: number
}

function getMeta<T extends object>(colDef: ColumnDef<T, unknown> | undefined): ColMeta | undefined {
  return (colDef as ColumnDef<T, unknown> & { meta?: ColMeta })?.meta
}

// Estimated row height (px) used by the virtualizer before real rows are measured.
const ESTIMATED_ROW_HEIGHT = 50

// Spacer rows above/below the virtualized window reserve the scroll height of the off-screen rows.
const spacerCellCss = (height: number) => css`
  height: ${height}px;
  padding: 0;
  border: none;
`

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

  // Column-coloring offsets differ per layout. Progress has a leading Student column plus a 2-wide
  // "Total" group before the colored chapter groups (groups from index 2, leaf cells from index 3).
  // Completions has only the Student column before its colored module groups (groups from index 1,
  // leaf cells from index 1). Hardcoding the Progress values mis-colored the Completions tab.
  const chapterHeaderStart = progressMode ? 2 : 1 // upper headers (groups) start index
  const subHeaderStart = progressMode ? 3 : 1 // lower headers / leaf cells start index

  const table = useReactTable({
    columns,
    data,
    state: { sorting: sorting ?? [] },
    onSortingChange,
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
  })

  const rows = table.getRowModel().rows
  const leafCount = table.getVisibleLeafColumns().length

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 12,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0

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
        return colorPairs[chapterIdx % colorPairs.length][0]
      }
      // Lower header (points/attempts)
      if (headerRow === 1 && colIdx >= subHeaderStart && header.colSpan === 1) {
        const pairIdx = Math.floor((colIdx - subHeaderStart) / 2)
        const subIdx = (colIdx - subHeaderStart) % 2
        return colorPairs[pairIdx % colorPairs.length][subIdx]
      }
      return undefined
    },
    [colorHeaders, chapterHeaderStart, subHeaderStart],
  )

  const renderTableHead = () => (
    <thead className={stickyTheadCss}>
      {table.getHeaderGroups().map((headerGroup, rowIdx) => {
        let chapterCount = 0
        return (
          <tr key={headerGroup.id} className={headerRowStyle}>
            {headerGroup.headers.map((header, colIdx) => {
              // Leaf headers spanning both header rows are already rendered in the first row.
              if (rowIdx === 1 && header.depth === 0 && header.colSpan === 1) {
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

              return (
                <th
                  key={header.id}
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
                    canSort
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            header.column.toggleSorting()
                          }
                        }
                      : undefined
                  }
                  tabIndex={canSort ? 0 : undefined}
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
                  rowSpan={header.depth === 0 && header.colSpan === 1 ? 2 : undefined}
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
    const isLast = rowIndex === rows.length - 1
    return (
      <tr
        key={row.id}
        data-index={rowIndex}
        ref={(node) => rowVirtualizer.measureElement(node)}
        className={rowStyle}
      >
        {row.getVisibleCells().map((cell, i) => {
          let bg: string | undefined = undefined
          if (colorColumns && i >= subHeaderStart) {
            const pairIdx = Math.floor((i - subHeaderStart) / 2)
            const subIdx = (i - subHeaderStart) % 2
            bg = colorPairs[pairIdx % colorPairs.length][subIdx]
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
            <td colSpan={leafCount} aria-hidden="true" className={spacerCellCss(paddingTop)} />
          </tr>
        )}
        {virtualItems.map((virtualItem) => renderRow(virtualItem.index))}
        {paddingBottom > 0 && (
          <tr aria-hidden="true">
            <td colSpan={leafCount} aria-hidden="true" className={spacerCellCss(paddingBottom)} />
          </tr>
        )}
      </tbody>
    )
  }

  return (
    <div className={tableViewportCss} ref={scrollRef}>
      <table className={tableStyle}>
        {renderTableHead()}
        {renderTableBody()}
      </table>
    </div>
  )
}
