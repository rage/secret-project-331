import { css, cx } from "@emotion/css"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import type { ColumnDef, Header } from "@tanstack/react-table"
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import { colorPairs } from "./studentsTableColors"
import {
  dockedTrailerCss,
  fixedTrailerShellDynamic,
  headerRowStyle,
  headerUnderlineCss,
  innerWidthDynamic,
  lastRowTdStyle,
  noLeftBorder,
  noRightBorder,
  PAD,
  rootRelative,
  rowStyle,
  stickyInnerCss,
  stickyShellCss,
  stickyShellDynamic,
  stickyTableWidthClass,
  tableCenteredInner,
  tableMinWidth,
  tableOuterScroll,
  tableRoundedWrap,
  tableStyle,
  tdStyle,
  thStyle,
  topScrollbarInner,
  topScrollbarWrap,
  trailerBarCss,
  trailerWrapCss,
  wrapAutoX,
  wrapHiddenX,
} from "./studentsTableStyles"

type ColMeta = {
  width?: number
  minWidth?: number
  padLeft?: number
  padRight?: number
}

function getMeta<T extends object>(colDef: ColumnDef<T, unknown> | undefined): ColMeta | undefined {
  return (colDef as ColumnDef<T, unknown> & { meta?: ColMeta })?.meta
}

const chapterHeaderStart = 2 // upper headers (groups) start index
const subHeaderStart = 3 // lower headers (points/attempts) start index

type FloatingHeaderTableProps<T extends object> = {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  colorHeaders?: boolean
  colorColumns?: boolean
  colorHeaderUnderline?: boolean
  progressMode?: boolean
}

export function FloatingHeaderTable<T extends object>({
  columns,
  data,
  colorHeaders = false,
  colorColumns = false,
  colorHeaderUnderline = false,
  progressMode = false,
}: FloatingHeaderTableProps<T>) {
  type HeaderBgArg = { colSpan: number }

  // Refs
  const tableRef = useRef<HTMLTableElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const stickyTableRef = useRef<HTMLTableElement | null>(null)
  const trailerRef = useRef<HTMLDivElement | null>(null)
  const syncingRef = useRef<null | "wrap" | "top">(null)
  const rafRef = useRef<number | null>(null)
  const latestScrollLeftRef = useRef(0)

  // State
  const [showSticky, setShowSticky] = useState(false)
  const [colWidths, setColWidths] = useState<number[]>([])
  const [wrapRect, setWrapRect] = useState({ left: 0, width: 0 })
  const [contentWidth, setContentWidth] = useState(0)
  const [showTrailer, setShowTrailer] = useState(false)
  const [bottomVisible, setBottomVisible] = useState(false)

  const table = useReactTable({ columns, data, getCoreRowModel: getCoreRowModel() })

  const innerWidthClass = React.useMemo(
    () => innerWidthDynamic(Math.max(contentWidth, wrapRect.width)),
    [contentWidth, wrapRect.width],
  )

  const fixedTrailerShellClass = React.useMemo(
    () => fixedTrailerShellDynamic(wrapRect.left, wrapRect.width),
    [wrapRect.left, wrapRect.width],
  )

  const wrapClass = bottomVisible ? wrapHiddenX : wrapAutoX

  const applyStickyTransform = useCallback((x: number) => {
    if (x === latestScrollLeftRef.current) {
      return
    }
    latestScrollLeftRef.current = x
    if (stickyTableRef.current) {
      stickyTableRef.current.style.transform = `translateX(-${x}px)`
    }
  }, [])

  const scheduleApplySticky = useCallback(
    (x: number) => {
      if (rafRef.current != null) {
        return
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        applyStickyTransform(x)
      })
    },
    [applyStickyTransform],
  )

  const measureWrapRect = useCallback(() => {
    if (!wrapRef.current) {
      return
    }
    const rect = wrapRef.current.getBoundingClientRect()
    setWrapRect({ left: rect.left, width: rect.width })
  }, [])

  const measureColWidths = useCallback(() => {
    if (!tableRef.current) {
      return
    }
    const ths = tableRef.current.querySelectorAll<HTMLTableCellElement>("thead tr:first-of-type th")
    if (!ths.length) {
      return
    }
    setColWidths(Array.from(ths).map((th) => th.offsetWidth))
  }, [])

  const measureContentWidth = useCallback(() => {
    if (!wrapRef.current) {
      return
    }
    setContentWidth(wrapRef.current.scrollWidth)
  }, [])

  const handleWindowScroll = useCallback(() => {
    if (!tableRef.current) {
      return
    }
    const rect = tableRef.current.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight

    // sticky header visible when table header scrolled off top but table still on screen
    setShowSticky(rect.top < 0 && rect.bottom > 48)

    // trailer visibility logic
    const tableOnScreen = rect.bottom > 0 && rect.top < vh
    const pastTop = rect.top < vh - 48
    const isBottomVisible = rect.bottom <= vh

    setShowTrailer(tableOnScreen && pastTop)
    setBottomVisible(isBottomVisible)
  }, [])

  const onWrapScroll = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) {
      return
    }

    // sync top trailer
    const trailer = trailerRef.current
    if (trailer && syncingRef.current !== "top") {
      // eslint-disable-next-line i18next/no-literal-string
      syncingRef.current = "wrap"
      trailer.scrollLeft = wrap.scrollLeft
      syncingRef.current = null
    }

    // keep sticky in lockstep
    applyStickyTransform(wrap.scrollLeft)
  }, [applyStickyTransform])

  const onTrailerScroll = useCallback(() => {
    const wrap = wrapRef.current
    const trailer = trailerRef.current
    if (!wrap || !trailer) {
      return
    }
    if (syncingRef.current !== "wrap") {
      // eslint-disable-next-line i18next/no-literal-string
      syncingRef.current = "top"
      wrap.scrollLeft = trailer.scrollLeft
      syncingRef.current = null
    }
    scheduleApplySticky(wrap.scrollLeft)
  }, [scheduleApplySticky])

  const getHeaderBg = useCallback(
    (headerRow: number, colIdx: number, header: HeaderBgArg): string | undefined => {
      if (!colorHeaders) {
        return undefined
      }

      // Upper header groups
      if (headerRow === 0 && colIdx >= chapterHeaderStart && header.colSpan === 2) {
        const chapterIdx = Math.floor((colIdx - chapterHeaderStart) / 1)
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
    [colorHeaders],
  )

  // 1) Measurements + observers (init + keep in sync)
  useEffect(() => {
    measureWrapRect()
    measureContentWidth()

    const ro = new ResizeObserver(() => {
      // keep viewport & content in sync
      measureWrapRect()
      measureContentWidth()
      // columns might reflow if fonts/space change → debounce via rAF for safety
      requestAnimationFrame(measureColWidths)
    })
    if (wrapRef.current) {
      ro.observe(wrapRef.current)
    }

    // Window resize (viewport changes)
    const onWinResize = () => {
      measureWrapRect()
      requestAnimationFrame(measureColWidths)
    }
    window.addEventListener("resize", onWinResize)

    // Window scroll: sticky + trailer visibility
    handleWindowScroll()
    window.addEventListener("scroll", handleWindowScroll, { passive: true })

    return () => {
      ro.disconnect()
      window.removeEventListener("resize", onWinResize)
      window.removeEventListener("scroll", handleWindowScroll)
    }
  }, [measureWrapRect, measureContentWidth, measureColWidths, handleWindowScroll])

  // 2) Scroll sync wiring (wrap ↔ trailer) + init positions
  useEffect(() => {
    const wrap = wrapRef.current
    const trailer = trailerRef.current
    if (!wrap) {
      return
    }

    // init positions (also ensures sticky transform matches current scroll)
    applyStickyTransform(wrap.scrollLeft)
    if (trailer) {
      trailer.scrollLeft = wrap.scrollLeft
    }

    // listeners
    wrap.addEventListener("scroll", onWrapScroll, { passive: true })
    trailer?.addEventListener("scroll", onTrailerScroll, { passive: true })

    return () => {
      wrap.removeEventListener("scroll", onWrapScroll)
      trailer?.removeEventListener("scroll", onTrailerScroll)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [onWrapScroll, onTrailerScroll, applyStickyTransform, showTrailer, bottomVisible])

  // 3) Render-time layout work (merged):
  useLayoutEffect(() => {
    const rafId = requestAnimationFrame(measureColWidths)

    const srcTable = tableRef.current
    const dstTable = stickyTableRef.current
    if (showSticky && srcTable && dstTable) {
      const srcThead = srcTable.tHead
      if (srcThead) {
        // clear previous
        if (dstTable.tHead) {
          dstTable.removeChild(dstTable.tHead)
        }

        // clone
        const clonedHead = srcThead.cloneNode(true) as HTMLTableSectionElement

        // read leaf widths from source
        const srcLeafThs = srcTable.querySelectorAll("thead tr:last-of-type th")
        const leafWidths = Array.from(srcLeafThs).map((th) => th.getBoundingClientRect().width)

        // apply to cloned leaves
        const clonedLeafThs = clonedHead.querySelectorAll("tr:last-of-type th")
        clonedLeafThs.forEach((th, i) => {
          const w = leafWidths[i]
          if (typeof w === "number") {
            const el = th as HTMLTableCellElement
            el.style.width = `${w}px`
            el.style.minWidth = `${w}px`
            el.style.maxWidth = `${w}px`
            el.style.boxSizing = "border-box"
          }
        })

        // fix group widths (sum of leaves)
        const clonedGroupRow = clonedHead.querySelector("tr:first-of-type")
        if (clonedGroupRow) {
          let cursor = 0

          clonedGroupRow.querySelectorAll("th").forEach((th) => {
            const el = th as HTMLTableCellElement
            const colSpan = Number(el.colSpan || 1)
            const sum = leafWidths.slice(cursor, cursor + colSpan).reduce((a, b) => a + b, 0)
            cursor += colSpan
            if (sum > 0) {
              el.style.width = `${sum}px`
              el.style.minWidth = `${sum}px`
              el.style.maxWidth = `${sum}px`
              el.style.boxSizing = "border-box"
            }
          })
        }

        // mount clone + freeze table width
        dstTable.appendChild(clonedHead)
        const tableW = srcTable.getBoundingClientRect().width
        dstTable.style.width = `${tableW}px`

        // sync transform with current scroll
        const wrap = wrapRef.current
        if (wrap) {
          dstTable.style.transform = `translateX(-${wrap.scrollLeft}px)`
        }
      }
    }

    return () => cancelAnimationFrame(rafId)
  }, [measureColWidths, showSticky, columns, data, contentWidth])

  const renderDockedTrailer = () => (
    <div className={dockedTrailerCss}>
      <div ref={trailerRef} className={cx(topScrollbarWrap, trailerWrapCss)}>
        <div className={cx(topScrollbarInner, innerWidthClass)} />
      </div>
    </div>
  )

  const renderTrailer = () => (
    <div className={fixedTrailerShellClass}>
      <div ref={trailerRef} className={cx(topScrollbarWrap, trailerBarCss)}>
        <div className={cx(topScrollbarInner, innerWidthClass)} />
      </div>
    </div>
  )

  const renderStickyHeader = () => {
    const shellDyn = stickyShellDynamic(wrapRect.left, wrapRect.width)
    const tableW = stickyTableWidthClass(Math.max(contentWidth, wrapRect.width))

    return (
      <div className={cx(stickyShellCss, shellDyn)}>
        <div className={stickyInnerCss}>
          <table ref={stickyTableRef} className={tableW} />
        </div>
      </div>
    )
  }

  const renderTableHead = () => (
    <thead>
      {table.getHeaderGroups().map((headerGroup, rowIdx) => {
        let chapterCount = 0

        return (
          <tr key={headerGroup.id} className={headerRowStyle}>
            {headerGroup.headers.map((header, colIdx) => {
              let removeRight = false
              let removeLeft = false

              // Remove border between Total points/attempts
              if (progressMode && rowIdx === 1 && colIdx === 1) {
                removeRight = true
              }
              if (progressMode && rowIdx === 1 && colIdx === 2) {
                removeLeft = true
              }

              // Remove borders between chapter points/attempts
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

              // Number the chapter headers on the upper row
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

              return (
                <th
                  key={header.id}
                  className={cx(
                    thStyle,
                    removeRight && noRightBorder,
                    removeLeft && noLeftBorder,
                    (() => {
                      const minW = getMeta<T>(header.column?.columnDef)?.minWidth ?? 80

                      const computedWidth = (() => {
                        if (
                          header.colSpan &&
                          header.colSpan > 1 &&
                          typeof header.getLeafHeaders === "function"
                        ) {
                          const leaves = header.getLeafHeaders() as Header<T, unknown>[]
                          const sumLeafMeta = leaves.reduce(
                            (acc: number, h: Header<T, unknown>) => {
                              const leafMeta = getMeta<T>(h.column?.columnDef)
                              const leafContentW =
                                typeof leafMeta?.width === "number"
                                  ? leafMeta.width
                                  : typeof leafMeta?.minWidth === "number"
                                    ? leafMeta.minWidth
                                    : 0
                              const leafTotalW = leafContentW + PAD * 2
                              return acc + leafTotalW
                            },
                            0,
                          )
                          return sumLeafMeta > 0 ? sumLeafMeta : colWidths[colIdx]
                        }
                        const meta = getMeta<T>(header.column?.columnDef)
                        if (typeof meta?.width === "number") {
                          return meta.width
                        }
                        if (typeof meta?.minWidth === "number") {
                          return meta.minWidth
                        }
                        return colWidths[colIdx]
                      })()

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
                        width: ${typeof computedWidth === "number" ? `${computedWidth}px` : "auto"};
                        ${bg ? `background: ${bg};` : ""}
                        position: relative;
                        overflow: visible;
                        padding-left: 16px;
                        padding-right: 16px;
                        ${needsPadTop ? `padding-top: 10px;` : ""}
                      `
                    })(),
                  )}
                  rowSpan={header.depth === 0 && header.colSpan === 1 ? 2 : undefined}
                  colSpan={header.colSpan > 1 ? header.colSpan : undefined}
                >
                  {headerLabel}

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

  const renderTableBody = () => (
    <tbody>
      {table.getRowModel().rows.map((row, rowIdx) => (
        <tr key={row.id} className={rowStyle}>
          {row.getVisibleCells().map((cell, i) => {
            const isLast = rowIdx === data.length - 1

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
            } // total points → attempts
            if (progressMode && i === 2) {
              removeLeft = true
            }
            if (progressMode && i >= subHeaderStart && (i - subHeaderStart) % 2 === 0) {
              removeRight = true
            } // chapter points → attempts
            if (progressMode && i >= subHeaderStart && (i - subHeaderStart) % 2 === 1) {
              removeLeft = true
            }

            return (
              <td
                key={cell.id}
                className={cx(
                  tdStyle, // base cell look (borders, font, height, etc.)
                  isLast && lastRowTdStyle,
                  removeRight && noRightBorder,
                  removeLeft && noLeftBorder,
                  (() => {
                    const meta = getMeta<T>(cell.column.columnDef)
                    const computedWidth =
                      typeof meta?.width === "number" ? meta.width : colWidths[i]
                    const minW = typeof meta?.minWidth === "number" ? meta.minWidth : undefined

                    const bgClass = bg
                      ? css`
                          background: ${bg};
                        `
                      : ""

                    // action column is a fixed narrow cell with tighter padding
                    if (cell.column.id === "actions") {
                      return cx(
                        bgClass,
                        css`
                          width: 80px;
                          min-width: 80px;
                          max-width: 80px;
                          padding-left: 4px;
                          padding-right: 4px;
                        `,
                      )
                    }

                    // normal content cells: width + minWidth (if any) + PAD padding
                    return cx(
                      bgClass,
                      css`
                        ${typeof computedWidth === "number" ? `width: ${computedWidth}px;` : ""}
                        ${typeof minW === "number" ? `min-width: ${minW}px;` : ""}
          padding-left: ${PAD}px;
                        padding-right: ${PAD}px;
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
      ))}
    </tbody>
  )

  return (
    <div className={cx(tableOuterScroll, rootRelative)}>
      {showSticky && renderStickyHeader()}
      {showTrailer && !bottomVisible && renderTrailer()}
      {showTrailer && bottomVisible && renderDockedTrailer()}

      <div className={tableCenteredInner}>
        <div className={tableRoundedWrap}>
          <div ref={wrapRef} className={wrapClass}>
            <table className={cx(tableStyle, tableMinWidth)} ref={tableRef}>
              {renderTableHead()}
              {renderTableBody()}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
