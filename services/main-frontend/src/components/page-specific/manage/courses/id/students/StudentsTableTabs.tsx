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
  border-radius: 8px;
  border: 1px solid #ced1d7;
  background: #fff;
  overflow: hidden;
  box-sizing: border-box;
`

// --- UNIVERSAL FLOATING HEADER TABLE ---
const chapterHeaderStart = 2 // First chapter header (upper, uses only light color)
const subHeaderStart = 3 // First subheader (lower, uses light/dark pair)

export function FloatingHeaderTable({ columns, data, colorHeaders = false, colorColumns = false }) {
  const tableRef = useRef(null)
  const wrapRef = useRef(null)
  const [showSticky, setShowSticky] = useState(false)
  const [colWidths, setColWidths] = useState([])
  const [scrollLeft, setScrollLeft] = useState(0)
  const [wrapRect, setWrapRect] = useState({ left: 0, width: 0 })
  const table = useReactTable({ columns, data, getCoreRowModel: getCoreRowModel() })

  // --- Effects for sticky header, colWidths, etc (unchanged) ---
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
    const wrap = wrapRef.current
    if (!wrap) {
      return
    }
    const handleScroll = () => setScrollLeft(wrap.scrollLeft)
    wrap.addEventListener("scroll", handleScroll)
    return () => wrap.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    function onScroll() {
      if (!tableRef.current) {
        return
      }
      const rect = tableRef.current.getBoundingClientRect()
      if (rect.top < 0 && rect.bottom > 48) {
        setShowSticky(true)
      } else {
        setShowSticky(false)
      }
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

  // --- TABLE HEAD RENDER (uses explicit widths) ---
  const renderTableHead = () => (
    <thead>
      {table.getHeaderGroups().map((headerGroup, rowIdx) => (
        <tr key={headerGroup.id} css={headerRowStyle}>
          {headerGroup.headers.map((header, colIdx) => (
            <th
              key={header.id}
              css={thStyle}
              style={{
                minWidth: 110,
                width: colWidths[colIdx],
                background: getHeaderBg(rowIdx, colIdx, header),
              }}
              rowSpan={header.depth === 0 && header.colSpan === 1 ? 2 : undefined}
              colSpan={header.colSpan > 1 ? header.colSpan : undefined}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
            </th>
          ))}
        </tr>
      ))}
    </thead>
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
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            margin: 0,
            pointerEvents: "none",
            transform: `translateX(-${scrollLeft}px)`,
          }}
        >
          {renderTableHead()}
        </table>
      </div>
    </div>
  )

  // --- BODY ---
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

            return (
              <td
                key={cell.id}
                css={[tdStyle, isLast && lastRowTdStyle]}
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
      <div css={tableCenteredInner}>
        <div css={tableRoundedWrap}>
          <div
            ref={wrapRef}
            style={{
              width: "100%",
              overflowX: "auto",
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
  />
)
