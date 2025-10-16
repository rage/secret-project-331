// StudentsTableTabs.tsx
import { css } from "@emotion/react"
import { useQuery } from "@tanstack/react-query"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { Eye, Pen } from "@vectopus/atlas-icons-react"
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { colorPairs } from "./studentsTableColors"
import {
  completionsColumns,
  completionsData,
  formatName,
  mockStudentsSorted,
  pointsColumns as progressColumns,
  pointsData as progressData,
} from "./studentsTableData"
import {
  headerRowStyle,
  lastRowTdStyle,
  noLeftBorder,
  noRightBorder,
  rowStyle,
  tableCenteredInner,
  tableOuterScroll,
  tableRoundedWrap,
  tableStyle,
  tdStyle,
  thStyle,
  topScrollbarInner,
  topScrollbarWrap,
} from "./studentsTableStyles"

import { getProgress } from "@/services/backend/courses/students"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

// --- STYLE ATOMS / HELPERS (top of file) ---
const padX = (px: number) => ({ paddingLeft: px, paddingRight: px })

const cellBase: React.CSSProperties = {
  whiteSpace: "nowrap",
  verticalAlign: "middle",
}

const actionCellFixed: React.CSSProperties = {
  width: 80,
  minWidth: 80,
  maxWidth: 80,
  ...padX(4),
}

const contentCell = (w?: number, minW?: number): React.CSSProperties => ({
  width: w,
  minWidth: minW,
  ...padX(16),
})

const stickyShellCss = css`
  position: fixed;
  top: 0;
  z-index: 100;
  pointer-events: none;
  background: transparent;
  overflow: hidden;
  margin: 0;
  padding: 0;
  transition:
    left 0.2s,
    width 0.2s;
`

const stickyInnerCss = css`
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
  background: #fff;
  overflow: hidden;
  display: inline-block;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
`

const trailerBarCss = css`
  pointer-events: auto;
  padding-left: 2px;
  padding-right: 2px;
`

const iconBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 6,
  border: "1px solid #d0d5dd",
  background: "#fff",
  cursor: "pointer",
}

const headerUnderlineCss = css`
  position: absolute;
  left: 0;
  right: 0;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  top: 0;
  z-index: 2;
  pointer-events: none;
`

const PAD = 16
const COMPLETIONS_LEAF_WIDTH = 120
const COMPLETIONS_LEAF_MIN_WIDTH = 80

const IconButton: React.FC<{
  label: string
  onClick?: () => void
  children: React.ReactNode
}> = ({ label, onClick, children }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} style={iconBtnStyle}>
    {children}
  </button>
)

// --- CONSTANTS ---
const chapterHeaderStart = 2 // upper headers (groups) start index
const subHeaderStart = 3 // lower headers (points/attempts) start index

// --- COMPONENT ---
export function FloatingHeaderTable({
  columns,
  data,
  colorHeaders = false,
  colorColumns = false,
  colorHeaderUnderline = false,
  progressMode = false,
}) {
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

  // ---------- Helpers ----------
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
      syncingRef.current = "top"
      wrap.scrollLeft = trailer.scrollLeft
      syncingRef.current = null
    }
    scheduleApplySticky(wrap.scrollLeft)
  }, [scheduleApplySticky])

  const getHeaderBg = useCallback(
    (headerRow: number, colIdx: number, header: any) => {
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
    // Re-run when we need fresh leaf widths (columns/data) or when sticky visibility toggles,
    // or when the content width changes enough to affect table width.
  }, [measureColWidths, showSticky, columns, data, contentWidth])

  // ---------- Render helpers ----------
  const renderDockedTrailer = () => (
    <div
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        width: "100%",
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <div
        ref={trailerRef}
        css={topScrollbarWrap}
        style={{ pointerEvents: "auto", paddingLeft: 2, paddingRight: 2 }}
      >
        <div css={topScrollbarInner} style={{ width: Math.max(contentWidth, wrapRect.width) }} />
      </div>
    </div>
  )

  const renderTrailer = () => (
    <div
      style={{
        position: "fixed",
        left: wrapRect.left,
        bottom: 0,
        width: wrapRect.width,
        zIndex: 100,
        pointerEvents: "none",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        ref={trailerRef}
        css={[topScrollbarWrap, trailerBarCss]}
        style={{ pointerEvents: "auto" }}
      >
        <div css={topScrollbarInner} style={{ width: Math.max(contentWidth, wrapRect.width) }} />
      </div>
    </div>
  )

  const renderStickyHeader = () => (
    <div css={stickyShellCss} style={{ left: wrapRect.left, width: wrapRect.width }}>
      <div css={stickyInnerCss}>
        <table
          ref={stickyTableRef}
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            width: Math.max(contentWidth, wrapRect.width),
          }}
        />
      </div>
    </div>
  )

  const renderTableHead = () => (
    <thead>
      {table.getHeaderGroups().map((headerGroup, rowIdx) => {
        let chapterCount = 0
        return (
          <tr key={headerGroup.id} css={headerRowStyle}>
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
        <tr key={row.id} css={rowStyle}>
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
                css={[
                  tdStyle,
                  isLast && lastRowTdStyle,
                  removeRight && noRightBorder,
                  removeLeft && noLeftBorder,
                ]}
                style={{
                  ...cellBase,
                  ...(cell.column.id === "actions"
                    ? actionCellFixed
                    : contentCell(
                        (cell.column.columnDef as any)?.meta?.width ?? colWidths[i],
                        (cell.column.columnDef as any)?.meta?.minWidth,
                      )),
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

// -- TABS --
export const UserTabContent = () => (
  <FloatingHeaderTable
    columns={[
      {
        header: "Name",
        id: "name",
        accessorFn: (row: { firstName: string | null; lastName: string | null }) =>
          `${row.lastName ? row.lastName : ""}${row.lastName && row.firstName ? ", " : ""}${
            row.firstName ? row.firstName : "(Missing Name)"
          }`,
      },
      { header: "User ID", accessorKey: "userId" },
      { header: "Email", accessorKey: "email" },
      { header: "Course Instance", accessorKey: "courseInstance" },
    ]}
    data={mockStudentsSorted}
  />
)

export const CertificatesTabContent = () => (
  <FloatingHeaderTable
    columns={[
      { header: "Student", accessorKey: "student" },
      { header: "Certificate", accessorKey: "certificate" },
      { header: "Date Issued", accessorKey: "date" },
      {
        header: "Actions",
        id: "actions",
        // tell the table this column should be narrow
        size: 80, // you can tweak (try 70–90)
        meta: { style: { paddingLeft: "4px", paddingRight: "4px" } }, // optional hint

        cell: ({ row }) => {
          const handleView = () => console.log("View certificate for:", row.original.student)
          const handleEdit = () => console.log("Edit certificate for:", row.original.student)

          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center", // ⬅️ changed from "flex-start"
                gap: 6, // spacing between buttons
                paddingLeft: "0px",
                paddingRight: "0px",
                width: "100%", // ensures flex centering spans full cell width
              }}
            >
              <IconButton label="View certificate" onClick={handleView}>
                <Eye size={18} />
              </IconButton>
              <IconButton label="Edit certificate" onClick={handleEdit}>
                <Pen size={18} />
              </IconButton>
            </div>
          )
        },
      },
    ]}
    data={mockStudentsSorted.map((s, i) => ({
      student: `${s.lastName ? s.lastName : ""}${s.lastName && s.firstName ? ", " : ""}${
        s.firstName ? s.firstName : "(Missing Name)"
      }`,
      certificate: i % 2 === 0 ? "Course Certificate" : "No Certificate",
      date: i % 2 === 0 ? "2025-09-02" : "-",
    }))}
  />
)

export const CompletionsTabContent = () => {
  const sizedCompletionsColumns = useMemo(() => {
    return completionsColumns.map((group: any, groupIdx: number) => {
      if (group.header === "Student") {
        return group
      }

      const colorPairIndex = groupIdx - 1
      return {
        ...group,
        meta: { ...(group.meta ?? {}), colorPairIndex },
        columns: group.columns.map((leaf: any, leafIdx: number) => ({
          ...leaf,
          meta: {
            ...(leaf.meta ?? {}),
            width: COMPLETIONS_LEAF_WIDTH,
            minWidth: COMPLETIONS_LEAF_MIN_WIDTH,
            colorPairIndex,
            subIdx: leafIdx % 2,
            padLeft: PAD,
            padRight: PAD,
          },
        })),
      }
    })
  }, [])

  return (
    <FloatingHeaderTable
      columns={sizedCompletionsColumns}
      data={completionsData}
      colorHeaders
      colorColumns
      colorHeaderUnderline
    />
  )
}

export const ProgressTabContent: React.FC<{ courseId: string }> = ({ courseId }) => {
  const query = useQuery({
    queryKey: ["progress-tab", courseId], // include id for correct caching
    queryFn: () => getProgress(courseId), // pass the string id
  })

  if (query.isLoading) {
    return <Spinner />
  }

  if (query.isError) {
    return <ErrorBanner error={query.error} />
  }

  console.log("Query data", query.data)

  return (
    <FloatingHeaderTable
      columns={progressColumns}
      data={progressData}
      colorHeaders
      colorColumns
      colorHeaderUnderline
      progressMode
    />
  )
}
