// StudentsTableTabs.tsx
import { css } from "@emotion/react"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import React, { useEffect, useRef, useState } from "react"

import { colorPairs } from "./studentsTableColors"

// StudentsTableTabs.tsx
import {
  baseStudents,
  completionsColumns,
  completionsData,
  mockStudents,
  pointsColumns,
  pointsData,
} from "./studentsTableData"
import {
  headerRowStyle,
  lastRowTdStyle,
  noLeftBorder,
  noRightBorder,
  rowStyle,
  tableOuterWrap,
  tableStyle,
  tdStyle,
  thStyle,
} from "./studentsTableStyles"

const tableOuterScroll = css`
  width: 100%;
  overflow-x: auto;
  /* no flex! */
  background: transparent;
  /* preserves scroll bar */
`

const tableCenteredInner = css`
  display: block;
  margin-left: auto;
  margin-right: auto;
  min-width: 900px;
  max-width: 90vw; // Optional: sets table max width to 90% of viewport
`

const tableRoundedWrap = css`
  position: relative;
  border-radius: 8px;
  border: 1px solid #ced1d7;
  background: #fff;
  overflow: hidden;
  box-sizing: border-box;
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

// --- UNIVERSAL FLOATING HEADER TABLE ---
const chapterHeaderStart = 2 // First chapter header (upper, uses only light color)
const subHeaderStart = 3 // First subheader (lower, uses light/dark pair)

export function FloatingHeaderTable({
  columns,
  data,
  colorHeaders = false,
  colorColumns = false,
  colorHeaderUnderline = false,
  progressMode = false,
}) {
  const tableRef = useRef(null)
  const wrapRef = useRef(null)
  const [showSticky, setShowSticky] = useState(false)
  const [colWidths, setColWidths] = useState([])
  const [scrollLeft, setScrollLeft] = useState(0)
  const [wrapRect, setWrapRect] = useState({ left: 0, width: 0 })
  const table = useReactTable({ columns, data, getCoreRowModel: getCoreRowModel() })

  const topScrollRef = useRef<HTMLDivElement | null>(null)
  const [contentWidth, setContentWidth] = useState(0)
  const syncingRef = useRef<null | "wrap" | "top">(null)
  const trailerRef = useRef<HTMLDivElement | null>(null)
  const [showTrailer, setShowTrailer] = useState(false)

  const stickyTableRef = useRef<HTMLTableElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const latestScrollLeftRef = useRef(0)

  const [bottomVisible, setBottomVisible] = useState(false)
  // optional derived booleans for clarity in render:
  const showFixedTrailer = showTrailer && !bottomVisible
  const showDockedTrailer = showTrailer && bottomVisible

  // --- Effects for sticky header, colWidths, etc (unchanged) ---
  useEffect(() => {
    const updateWidth = () => {
      if (!wrapRef.current) {
        return
      }
      // full scrollable width of the table content
      setContentWidth(wrapRef.current.scrollWidth)
    }
    updateWidth()
    window.addEventListener("resize", updateWidth)
    const id = setInterval(updateWidth, 200) // catches font/layout async changes
    return () => {
      window.removeEventListener("resize", updateWidth)
      clearInterval(id)
    }
  }, [data.length, colWidths.join(",")])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) {
      return
    }

    const apply = (x: number) => {
      if (x === latestScrollLeftRef.current) {
        return
      }
      latestScrollLeftRef.current = x
      if (stickyTableRef.current) {
        stickyTableRef.current.style.transform = `translateX(-${x}px)`
      }
    }

    const scheduleApply = () => {
      if (rafRef.current != null) {
        return
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        apply(wrap.scrollLeft)
      })
    }

    // always keep sticky header in sync with the main scroller
    const onWrapScroll = () => {
      const trailer = trailerRef.current
      if (trailer && syncingRef.current !== "top") {
        syncingRef.current = "wrap"
        trailer.scrollLeft = wrap.scrollLeft
        syncingRef.current = null
      }
      apply(wrap.scrollLeft) // immediate for zero lag
    }

    // (re)attach listeners
    wrap.addEventListener("scroll", onWrapScroll, { passive: true })

    const trailer = trailerRef.current
    const onTrailerScroll = () => {
      if (syncingRef.current !== "wrap") {
        syncingRef.current = "top"
        wrap.scrollLeft = trailer!.scrollLeft
        syncingRef.current = null
      }
      scheduleApply()
    }
    if (trailer) {
      trailer.scrollLeft = wrap.scrollLeft
      trailer.addEventListener("scroll", onTrailerScroll, { passive: true })
    }

    // initialize sticky header position (covers mount + trailer swap)
    apply(wrap.scrollLeft)

    return () => {
      wrap.removeEventListener("scroll", onWrapScroll)
      if (trailer) {
        trailer.removeEventListener("scroll", onTrailerScroll)
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [
    showTrailer, // trailer visible or not
    bottomVisible, // switches fixed ↔ docked (new element)
  ]) // ← key change

  useEffect(() => {
    if (showSticky && stickyTableRef.current && wrapRef.current) {
      stickyTableRef.current.style.transform = `translateX(-${wrapRef.current.scrollLeft}px)`
    }
  }, [showSticky])

  useEffect(() => {
    if (tableRef.current) {
      const ths = tableRef.current.querySelectorAll("thead tr:first-of-type th")
      setColWidths(Array.from(ths).map((th) => th.offsetWidth))
    }
  }, [data.length])

  useEffect(() => {
    function updateRect() {
      if (!wrapRef.current) {
        return
      }
      const rect = wrapRef.current.getBoundingClientRect()
      setWrapRect({ left: rect.left, width: rect.width })
    }
    window.addEventListener("scroll", updateRect, { passive: true })
    window.addEventListener("resize", updateRect)
    updateRect()
    return () => {
      window.removeEventListener("scroll", updateRect)
      window.removeEventListener("resize", updateRect)
    }
  }, [])

  useEffect(() => {
    function onScroll() {
      if (!tableRef.current) {
        return
      }
      const rect = tableRef.current.getBoundingClientRect()
      const vh = window.innerHeight || document.documentElement.clientHeight

      // sticky header
      setShowSticky(rect.top < 0 && rect.bottom > 48)

      // visibility
      const tableOnScreen = rect.bottom > 0 && rect.top < vh
      const pastTop = rect.top < vh - 48
      const isBottomVisible = rect.bottom <= vh

      // trailer exists whenever table is on screen and we've moved past the top a bit
      setShowTrailer(tableOnScreen && pastTop)
      setBottomVisible(isBottomVisible)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  function getHeaderBg(headerRow, colIdx, header) {
    if (!colorHeaders) {
      return undefined
    }
    // UPPER HEADER ROW (chapter group headers)
    if (headerRow === 0 && colIdx >= chapterHeaderStart && header.colSpan === 2) {
      const chapterIdx = Math.floor((colIdx - chapterHeaderStart) / 1)
      return colorPairs[chapterIdx % colorPairs.length][0] // lighter color
    }
    // LOWER HEADER ROW (subcolumns: points/attempted)
    if (headerRow === 1 && colIdx >= subHeaderStart && header.colSpan === 1) {
      const pairIdx = Math.floor((colIdx - subHeaderStart) / 2)
      const subIdx = (colIdx - subHeaderStart) % 2
      return colorPairs[pairIdx % colorPairs.length][subIdx]
    }
    return undefined
  }

  const renderDockedTrailer = () => (
    <div
      style={{
        position: "absolute", // docked inside the table container
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
        style={{
          pointerEvents: "auto",
          paddingLeft: 2,
          paddingRight: 2,
        }}
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
        // keep clear of notches / iOS home bar if applicable
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        ref={trailerRef}
        css={topScrollbarWrap}
        style={{
          pointerEvents: "auto",
          // small inward padding so the thumb doesn't touch edges hard
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        <div css={topScrollbarInner} style={{ width: Math.max(contentWidth, wrapRect.width) }} />
      </div>
    </div>
  )

  // --- STICKY HEADER RENDER (EXACT SAME WIDTHS) ---
  const renderStickyHeader = () => (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: wrapRect.left,
        width: wrapRect.width,
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
          minWidth: 900,
          borderRadius: "8px 8px 0 0",
          border: "1px solid #ced1d7",
          background: "#fff",
          overflow: "hidden",
          display: "inline-block",
          margin: 0,
        }}
      >
        <table
          ref={stickyTableRef}
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            margin: 0,
            pointerEvents: "none",
            transform: "translate3d(0,0,0)", // prime compositing
            willChange: "transform",
            contain: "paint",
            backfaceVisibility: "hidden",
          }}
        >
          {renderTableHead()}
        </table>
      </div>
    </div>
  )

  // --- TABLE HEAD RENDER (uses explicit widths) ---
  const renderTableHead = () => (
    <thead>
      {table.getHeaderGroups().map((headerGroup, rowIdx) => {
        // Track chapter index for header row 0 only
        let chapterCount = 0
        return (
          <tr key={headerGroup.id} css={headerRowStyle}>
            {headerGroup.headers.map((header, colIdx) => {
              let removeRight = false
              let removeLeft = false

              // --- Remove border between Total Points/Attempts
              if (progressMode && rowIdx === 1 && colIdx === 1) {
                removeRight = true
              }
              if (progressMode && rowIdx === 1 && colIdx === 2) {
                removeLeft = true
              }

              // --- Remove borders between chapter points/attempts
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

              // Chapter indexing logic: only for upper header row, after "Total"
              let headerLabel = flexRender(header.column.columnDef.header, header.getContext())
              if (rowIdx === 0 && colIdx >= chapterHeaderStart && header.colSpan === 2) {
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
                  css={[thStyle, removeRight && noRightBorder, removeLeft && noLeftBorder]}
                  style={{
                    minWidth: 110,
                    width: colWidths[colIdx],
                    background:
                      colorHeaders && !colorHeaderUnderline
                        ? getHeaderBg(rowIdx, colIdx, header)
                        : undefined,
                    position: "relative",
                    overflow: "visible",
                  }}
                  rowSpan={header.depth === 0 && header.colSpan === 1 ? 2 : undefined}
                  colSpan={header.colSpan > 1 ? header.colSpan : undefined}
                >
                  {headerLabel}
                  {/* Only show underline for upper header, if enabled */}
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
                          bottom: "4px",
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

            // --- Remove border between Total Points/Attempts
            if (progressMode && i === 1) {
              removeRight = true
            }
            if (progressMode && i === 2) {
              removeLeft = true
            }

            // --- Remove borders between chapter points/attempts (all other pairs)
            if (progressMode && i >= subHeaderStart && (i - subHeaderStart) % 2 === 0) {
              removeRight = true
            }
            if (progressMode && i >= subHeaderStart && (i - subHeaderStart) % 2 === 1) {
              removeLeft = true
            }

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
                  width: colWidths[i],
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

  // --- SCROLL & ROUNDED WRAP (native scrollbar only) ---
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
              overflowX: bottomVisible ? "hidden" : "auto", // <-- hide native when bottom visible
              overflowY: "hidden",
              borderRadius: 8,
              border: "none",
              background: "none",
            }}
          >
            <table
              css={tableStyle}
              ref={tableRef}
              style={{
                minWidth: 900,
              }}
            >
              {renderTableHead()}
              {renderTableBody()}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// -- EXPORT TABLE CONTENTS FOR TABS --
export const UserTabContent = () => (
  <FloatingHeaderTable
    columns={[
      { header: "First Name", accessorKey: "firstName" },
      { header: "Last Name", accessorKey: "lastName" },
      { header: "User ID", accessorKey: "userId" },
      { header: "Email", accessorKey: "email" },
      { header: "Course Instance", accessorKey: "courseInstance" },
    ]}
    data={mockStudents}
  />
)
export const CertificatesTabContent = () => (
  <FloatingHeaderTable
    columns={[
      { header: "Student", accessorKey: "student" },
      { header: "Certificate", accessorKey: "certificate" },
      { header: "Date Issued", accessorKey: "date" },
    ]}
    data={mockStudents.map((s, i) => ({
      student: `${s.firstName} ${s.lastName}`,
      certificate: i % 2 === 0 ? "Course Certificate" : "No Certificate",
      date: i % 2 === 0 ? "2025-09-02" : "-",
    }))}
  />
)
export const CompletionsTabContent = () => (
  <FloatingHeaderTable columns={completionsColumns} data={completionsData} />
)
export const PointsTabContent = () => (
  <FloatingHeaderTable
    columns={pointsColumns}
    data={pointsData}
    colorHeaders={true}
    colorColumns={true}
    colorHeaderUnderline={true}
    progressMode={true}
  />
)
