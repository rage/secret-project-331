// StudentsTableTabs.tsx
import { css } from "@emotion/react"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import React, { useEffect, useRef, useState } from "react"

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
  altBgStyle,
  headerRowStyle,
  lastRowTdStyle,
  rowStyle,
  tableOuterWrap,
  tableStyle,
  tdStyle,
  thStyle,
} from "./studentsTableStyles"

// --- UNIVERSAL FLOATING HEADER TABLE ---
// StudentsTableTabs.tsx

export function FloatingHeaderTable({ columns, data }) {
  const tableRef = useRef(null)
  const wrapRef = useRef(null)
  const [showSticky, setShowSticky] = useState(false)
  const [colWidths, setColWidths] = useState([])
  const [scrollLeft, setScrollLeft] = useState(0)
  const [wrapRect, setWrapRect] = useState({ left: 0, width: 0 })
  const table = useReactTable({ columns, data, getCoreRowModel: getCoreRowModel() })

  // Update column widths
  useEffect(() => {
    if (tableRef.current) {
      const ths = tableRef.current.querySelectorAll("thead tr:first-of-type th")
      setColWidths(Array.from(ths).map((th) => th.offsetWidth))
    }
  }, [data.length])

  // Listen for scroll and update scrollLeft
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) {
      return
    }
    const handleScroll = () => setScrollLeft(wrap.scrollLeft)
    wrap.addEventListener("scroll", handleScroll)
    return () => wrap.removeEventListener("scroll", handleScroll)
  }, [])

  // Update wrapRect for left and width
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

  // Show sticky header when table header is scrolled out of view
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

  return (
    <div css={tableOuterWrap} ref={wrapRef} style={{ position: "relative" }}>
      {/* Sticky header: fixed to top of window, horizontally synced to scrollable area */}
      {showSticky && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: wrapRect.left,
            width: wrapRect.width,
            zIndex: 100,
            pointerEvents: "none",
            background: "#f7f8f9",
            boxShadow: "0 2px 6px 0 rgba(0,0,0,0.04)",
            overflow: "hidden",
            margin: 0,
            padding: 0,
            transition: "left 0.2s, width 0.2s",
          }}
        >
          <table
            css={tableStyle}
            style={{
              transform: `translateX(-${scrollLeft}px)`,
              margin: 0,
              pointerEvents: "none", // Make sure it's not interactive
            }}
          >
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} css={headerRowStyle}>
                  {headerGroup.headers.map((header, i) => (
                    <th
                      key={header.id}
                      css={[thStyle, header.column.columnDef.meta?.altBg && altBgStyle]}
                      style={{ minWidth: 110, width: colWidths[i] }}
                      rowSpan={header.depth === 0 && header.colSpan === 1 ? 2 : undefined}
                      colSpan={header.colSpan > 1 ? header.colSpan : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
          </table>
        </div>
      )}
      {/* Real table */}
      <table css={tableStyle} ref={tableRef}>
        {/* ... as before ... */}
        <thead>
          {table.getHeaderGroups().map((headerGroup, idx) => (
            <tr key={headerGroup.id} css={headerRowStyle}>
              {headerGroup.headers.map((header, i) => (
                <th
                  key={header.id}
                  css={[thStyle, header.column.columnDef.meta?.altBg && altBgStyle]}
                  style={{ minWidth: 110, width: colWidths[i] }}
                  rowSpan={header.depth === 0 && header.colSpan === 1 ? 2 : undefined}
                  colSpan={header.colSpan > 1 ? header.colSpan : undefined}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, idx) => (
            <tr key={row.id} css={rowStyle}>
              {row.getVisibleCells().map((cell, i) => {
                const isLast = idx === data.length - 1
                return (
                  <td
                    key={cell.id}
                    css={[
                      tdStyle,
                      cell.column.columnDef.meta?.altBg && altBgStyle,
                      isLast && lastRowTdStyle,
                    ]}
                    style={{ width: colWidths[i] }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
  <FloatingHeaderTable columns={pointsColumns} data={pointsData} />
)
