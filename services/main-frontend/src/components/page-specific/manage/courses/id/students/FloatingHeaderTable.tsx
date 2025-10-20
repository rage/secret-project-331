import { css, cx } from "@emotion/css"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import type { ColumnDef } from "@tanstack/react-table"
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import { colorPairs } from "./studentsTableColors"
import {
  actionCellFixed,
  cellBase,
  contentCell,
  headerRowStyle,
  headerUnderlineCss,
  lastRowTdStyle,
  noLeftBorder,
  noRightBorder,
  PAD,
  rowStyle,
  stickyInnerCss,
  stickyShellCss,
  stickyShellDynamic,
  stickyTableWidthClass,
  tableCenteredInner,
  tableOuterScroll,
  tableRoundedWrap,
  tableStyle,
  tdStyle,
  thStyle,
  trailerBarCss,
} from "./studentsTableStyles"

// --- TD classes using @emotion/css (className-based) ---
const tdClass = css`
  color: #1a2333;
  opacity: 0.8;
  font-weight: 400;
  font-size: 14px;
  line-height: 140%;
  height: 50px;
  vertical-align: middle;
  background: #fff;
  border-bottom: 1px solid #ced1d7;
  border-right: 1px solid #ced1d7;
  white-space: nowrap;
`

const lastRowTdClass = css`
  border-bottom: none;
`

const noRightBorderClass = css`
  border-right: none !important;
`

const noLeftBorderClass = css`
  border-left: none !important;
`

const dockedTrailerClass = css`
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  z-index: 60;
  pointer-events: none;
`

const topScrollbarWrap = css`
  height: 7px;
  overflow-x: auto;
  overflow-y: hidden;
  pointer-events: auto;
  background: transparent;
  border: none;

  /* was -11px when under header; not needed for trailer */
  margin-top: 0;

  /* WebKit */
  &::-webkit-scrollbar {
    height: 20px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #000;
    border-radius: 8px;
    border-left: 2px solid transparent;
    border-right: 2px solid transparent;
    background-clip: padding-box;
  }

  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: #000 transparent;
`

const topScrollbarInner = css`
  /* Keep height equal to scrollbar so it doesn’t add extra spacing */
  height: 0px; /* no need for vertical size here */
  width: 100%;
`

// --- CONSTANTS ---
const chapterHeaderStart = 2 // upper headers (groups) start index
const subHeaderStart = 3 // lower headers (points/attempts) start index

type FloatingHeaderTableProps<T extends object> = {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  // existing optional flags you already support:
  colorHeaders?: boolean
  colorColumns?: boolean
  colorHeaderUnderline?: boolean
  progressMode?: boolean
}

// --- COMPONENT ---
export function FloatingHeaderTable<T extends object>({
  columns,
  data,
  colorHeaders = false,
  colorColumns = false,
  colorHeaderUnderline = false,
  progressMode = false,
}: FloatingHeaderTableProps<T>) {
  const reactTable = useReactTable<T>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

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

  // Docked trailer container (was inline style)
  const trailerWrapClass = css`
    pointer-events: auto;
    padding-left: 2px;
    padding-right: 2px;
  `

  const innerWidthClass = React.useMemo(
    () => css`
      width: ${Math.max(contentWidth, wrapRect.width)}px;
    `,
    [contentWidth, wrapRect.width],
  )

  const dockedTrailerClass = css`
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    z-index: 60;
    pointer-events: none;
  `

  const fixedTrailerShellClass = React.useMemo(
    () => css`
      position: fixed;
      left: ${wrapRect.left}px;
      bottom: 0;
      width: ${wrapRect.width}px;
      z-index: 100;
      pointer-events: none;
      padding-bottom: env(safe-area-inset-bottom);
    `,
    [wrapRect.left, wrapRect.width],
  )

  // ---------- Helpers ----------
  const applyStickyTransform = useCallback((x: number) => {
    if (x === latestScrollLeftRef.current) {
      return
    }
    latestScrollLeftRef.current = x
    if (stickyTableRef.current) {
      // eslint-disable-next-line i18next/no-literal-string
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
    // eslint-disable-next-line i18next/no-literal-string
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

  // --- EFFECTS (condensed) ---

  // 1) Measurements + observers (init + keep in sync)
  //    - Keeps wrapRect, contentWidth, and col widths fresh
  useEffect(() => {
    // initial pass
    measureWrapRect()
    measureContentWidth()

    // ResizeObserver on the scroll wrap to catch content width + layout changes
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
      // headers can reflow after resize → rAF ensures layout is settled
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
    // helpers are stable via useCallback; no need to depend on frequently-changing state
  }, [measureWrapRect, measureContentWidth, measureColWidths, handleWindowScroll])

  // 2) Scroll sync wiring (wrap ↔ trailer) + init positions
  //    - Rebind only when trailer appears/disappears or handlers change
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
  //    a) After data/columns render: measure leaf widths (rAF, lets layout settle)
  //    b) When sticky is visible: clone & freeze the header (pixel-perfect widths)
  useLayoutEffect(() => {
    // (a) measure leaf widths next frame (only when data/columns change)
    const rafId = requestAnimationFrame(measureColWidths)

    // (b) sticky header clone (only when visible and refs are ready)
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
        // eslint-disable-next-line i18next/no-literal-string
        const srcLeafThs = srcTable.querySelectorAll("thead tr:last-of-type th")
        const leafWidths = Array.from(srcLeafThs).map((th) => th.getBoundingClientRect().width)

        // apply to cloned leaves
        // eslint-disable-next-line i18next/no-literal-string
        const clonedLeafThs = clonedHead.querySelectorAll("tr:last-of-type th")
        clonedLeafThs.forEach((th, i) => {
          const w = leafWidths[i]
          if (typeof w === "number") {
            const el = th as HTMLTableCellElement
            // eslint-disable-next-line i18next/no-literal-string
            el.style.width = `${w}px`
            // eslint-disable-next-line i18next/no-literal-string
            el.style.minWidth = `${w}px`
            // eslint-disable-next-line i18next/no-literal-string
            el.style.maxWidth = `${w}px`
            // eslint-disable-next-line i18next/no-literal-string
            el.style.boxSizing = "border-box"
          }
        })

        // fix group widths (sum of leaves)
        const clonedGroupRow = clonedHead.querySelector("tr:first-of-type")
        if (clonedGroupRow) {
          let cursor = 0
          // eslint-disable-next-line i18next/no-literal-string
          clonedGroupRow.querySelectorAll("th").forEach((th) => {
            const el = th as HTMLTableCellElement
            const colSpan = Number(el.colSpan || 1)
            const sum = leafWidths.slice(cursor, cursor + colSpan).reduce((a, b) => a + b, 0)
            cursor += colSpan
            if (sum > 0) {
              // eslint-disable-next-line i18next/no-literal-string
              el.style.width = `${sum}px`
              // eslint-disable-next-line i18next/no-literal-string
              el.style.minWidth = `${sum}px`
              // eslint-disable-next-line i18next/no-literal-string
              el.style.maxWidth = `${sum}px`
              // eslint-disable-next-line i18next/no-literal-string
              el.style.boxSizing = "border-box"
            }
          })
        }

        // mount clone + freeze table width
        dstTable.appendChild(clonedHead)
        const tableW = srcTable.getBoundingClientRect().width
        // eslint-disable-next-line i18next/no-literal-string
        dstTable.style.width = `${tableW}px`

        // sync transform with current scroll
        const wrap = wrapRef.current
        if (wrap) {
          // eslint-disable-next-line i18next/no-literal-string
          dstTable.style.transform = `translateX(-${wrap.scrollLeft}px)`
        }
      }
    }

    return () => cancelAnimationFrame(rafId)
    // Re-run when we need fresh leaf widths (columns/data) or when sticky visibility toggles,
    // or when the content width changes enough to affect table width.
  }, [measureColWidths, showSticky, columns, data, contentWidth])

  // ---------- Render helpers ----------
  const renderDockedTrailer = () => (
    <div className={dockedTrailerClass}>
      <div ref={trailerRef} className={cx(topScrollbarWrap, trailerWrapClass)}>
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

              const hMeta = (header.column?.columnDef as any)?.meta as
                | { padLeft?: number; padRight?: number }
                | undefined
              return (
                <th
                  key={header.id}
                  css={[thStyle, removeRight && noRightBorder, removeLeft && noLeftBorder]}
                  style={{
                    minWidth:
                      ((header.column?.columnDef as any)?.meta?.minWidth as number | undefined) ??
                      80,
                    width: (() => {
                      if (
                        header.colSpan &&
                        header.colSpan > 1 &&
                        typeof header.getLeafHeaders === "function"
                      ) {
                        const leaves = header.getLeafHeaders()
                        // Sum leaf content widths AND their horizontal padding to match real table width
                        const sumLeafMeta = leaves.reduce((acc: number, h: any) => {
                          const leafMeta = (h.column?.columnDef as any)?.meta as
                            | { width?: number; minWidth?: number }
                            | undefined
                          const leafContentW =
                            typeof leafMeta?.width === "number"
                              ? leafMeta.width // e.g., 120
                              : typeof leafMeta?.minWidth === "number"
                                ? leafMeta.minWidth
                                : 0
                          const leafTotalW = leafContentW + PAD * 2 // add 16 left + 16 right
                          return acc + leafTotalW
                        }, 0)
                        return sumLeafMeta > 0 ? sumLeafMeta : colWidths[colIdx]
                      }

                      // Leaf header: prefer meta.width/minWidth; else fallback to measured
                      const meta = (header.column?.columnDef as any)?.meta as
                        | { width?: number; minWidth?: number }
                        | undefined
                      if (typeof meta?.width === "number") {
                        return meta.width
                      }
                      if (typeof meta?.minWidth === "number") {
                        return meta.minWidth
                      }
                      return colWidths[colIdx]
                    })(),

                    background:
                      colorHeaders && !colorHeaderUnderline
                        ? getHeaderBg(rowIdx, colIdx, header)
                        : undefined,
                    position: "relative",
                    overflow: "visible",

                    paddingLeft: 16,
                    paddingRight: 16,

                    paddingTop:
                      colorHeaderUnderline &&
                      rowIdx === 0 &&
                      colIdx >= chapterHeaderStart &&
                      header.colSpan === 2
                        ? 10
                        : undefined,
                  }}
                  rowSpan={header.depth === 0 && header.colSpan === 1 ? 2 : undefined}
                  colSpan={header.colSpan > 1 ? header.colSpan : undefined}
                >
                  {headerLabel}

                  {colorHeaderUnderline &&
                    rowIdx === 0 &&
                    colIdx >= chapterHeaderStart &&
                    header.colSpan === 2 && (
                      <span
                        css={headerUnderlineCss}
                        style={{ background: getHeaderBg(rowIdx, colIdx, header) }}
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

            const meta = (cell.column.columnDef as any)?.meta as
              | { width?: number; minWidth?: number; padLeft?: number; padRight?: number }
              | undefined

            return (
              <td
                className={cx(
                  tdClass,
                  isLast && lastRowTdClass,
                  removeRight && noRightBorderClass,
                  removeLeft && noLeftBorderClass,
                )}
                style={{
                  // keep per-cell dimensions in inline style (plain CSSProperties)
                  ...(cell.column.id === "actions"
                    ? {
                        width: 80,
                        minWidth: 80,
                        maxWidth: 80,
                        paddingLeft: 4,
                        paddingRight: 4,
                      }
                    : {
                        width:
                          ((cell.column.columnDef as any)?.meta?.width as number | undefined) ??
                          colWidths[i],
                        minWidth: (cell.column.columnDef as any)?.meta?.minWidth as
                          | number
                          | undefined,
                        paddingLeft: PAD,
                        paddingRight: PAD,
                      }),
                  background: bg,
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            )
          })}
        </tr>
      ))}
    </tbody>
  )

  // ---------- Render ----------
  return (
    <div css={tableOuterScroll} style={{ position: "relative" }}>
      {showSticky && renderStickyHeader()}
      {showTrailer && !bottomVisible && renderTrailer()}
      {showTrailer && bottomVisible && renderDockedTrailer()}

      <div css={tableCenteredInner}>
        <div css={tableRoundedWrap}>
          <div
            ref={wrapRef}
            style={{
              width: "100%",
              overflowX: bottomVisible ? "hidden" : "auto",
              overflowY: "hidden",
              borderRadius: 8,
              border: "none",
              background: "none",
            }}
          >
            <table css={tableStyle} ref={tableRef} style={{ minWidth: 900 }}>
              {renderTableHead()}
              {renderTableBody()}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
