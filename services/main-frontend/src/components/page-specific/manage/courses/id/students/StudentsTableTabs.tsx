// StudentsTableTabs.tsx
import { css } from "@emotion/react"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { Eye, Pen } from "@vectopus/atlas-icons-react"
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { colorPairs } from "./studentsTableColors"
import {
  completionsColumns,
  completionsData,
  formatName,
  mockStudentsSorted,
  pointsColumns,
  pointsData,
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

  // Measure column widths after data/columns render
  useLayoutEffect(() => {
    // measure on next frame to let layout settle
    const id = requestAnimationFrame(measureColWidths)
    return () => cancelAnimationFrame(id)
  }, [measureColWidths, data.length, columns])

  // Keep wrapRect and contentWidth in sync with layout changes (ResizeObserver + window resize)
  useEffect(() => {
    measureWrapRect()
    measureContentWidth()

    const ro = new ResizeObserver(() => {
      measureWrapRect()
      measureContentWidth()
      // columns might reflow if fonts/space change
      measureColWidths()
    })
    if (wrapRef.current) {
      ro.observe(wrapRef.current)
    }
    window.addEventListener("resize", measureWrapRect)

    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measureWrapRect)
    }
  }, [measureWrapRect, measureContentWidth, measureColWidths])

  // Window scroll: sticky header + trailer visibility
  useEffect(() => {
    handleWindowScroll()
    window.addEventListener("scroll", handleWindowScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleWindowScroll)
  }, [handleWindowScroll])

  // Sync scroll between wrap and trailer; keep sticky header transform updated
  useEffect(() => {
    const wrap = wrapRef.current
    const trailer = trailerRef.current
    if (!wrap) {
      return
    }

    // initialize positions
    applyStickyTransform(wrap.scrollLeft)
    if (trailer) {
      trailer.scrollLeft = wrap.scrollLeft
    }

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

  useLayoutEffect(() => {
    if (!showSticky) {
      return
    }
    const wrap = wrapRef.current
    const sticky = stickyTableRef.current
    if (wrap && sticky) {
      sticky.style.transform = `translateX(-${wrap.scrollLeft}px)`
    }
  }, [showSticky])

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
        css={topScrollbarWrap}
        style={{ pointerEvents: "auto", paddingLeft: 2, paddingRight: 2 }}
      >
        <div css={topScrollbarInner} style={{ width: Math.max(contentWidth, wrapRect.width) }} />
      </div>
    </div>
  )

  const renderStickyHeader = () => (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: wrapRect.left,
        width: wrapRect.width, // keep the viewport clip the same
        zIndex: 100,
        pointerEvents: "none",
        background: "transparent",
        overflow: "hidden",
        margin: 0,
        padding: 0,
        transition: "left 0.2s, width 0.2s",
      }}
    >
      <div
        style={{
          // no border/radius (you already removed), keep layout-neutral
          boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
          background: "#fff",
          overflow: "hidden",
          display: "inline-block",
          margin: 0,
          padding: 0,
          boxSizing: "border-box",
          // ❌ remove width: "100%" so the inner table can be its true content width
          // width: "100%",
        }}
      >
        <table
          ref={stickyTableRef}
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            margin: 0,
            pointerEvents: "none",
            transform: "translate3d(0,0,0)",
            willChange: "transform",
            contain: "paint",
            backfaceVisibility: "hidden",

            // ✅ let the sticky header have the same intrinsic width as the content
            // (this is the full scrollable width of the real table)
            width: Math.max(contentWidth, wrapRect.width),

            // ❌ don’t force a different layout algorithm here
            // tableLayout: "fixed",
          }}
        >
          {renderTableHead()}
        </table>
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
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          width: "100%",
                          height: 4,
                          background: getHeaderBg(rowIdx, colIdx, header),
                          borderRadius: 2,
                          top: "0px",
                          zIndex: 2,
                          pointerEvents: "none",
                        }}
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
                key={cell.id}
                css={[
                  tdStyle,
                  isLast && lastRowTdStyle,
                  removeRight && noRightBorder,
                  removeLeft && noLeftBorder,
                ]}
                style={{
                  width: meta?.width ?? colWidths[i],
                  minWidth: meta?.minWidth,
                  paddingLeft: 16,
                  paddingRight: 16,
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

export const PointsTabContent = () => (
  <FloatingHeaderTable
    columns={pointsColumns}
    data={pointsData}
    colorHeaders
    colorColumns
    colorHeaderUnderline
    progressMode
  />
)
