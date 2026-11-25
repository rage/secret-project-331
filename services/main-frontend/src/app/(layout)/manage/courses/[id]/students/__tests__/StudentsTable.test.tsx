"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { render, screen } from "@testing-library/react"

import { StudentsTable } from "../StudentsTable"
import type { StudentsTableFeatures } from "../studentsTableFeatures"

interface Row {
  email: string
}

const columns: ColumnDef<StudentsTableFeatures, Row, unknown>[] = [
  { id: "email", header: "Email", accessorKey: "email", enableSorting: true },
]

describe("StudentsTable header", () => {
  it("exposes a sortable header as a button named by its label only", () => {
    render(
      <StudentsTable
        columns={columns}
        data={[{ email: "a@example.com" }]}
        sorting={[{ id: "email", desc: false }]}
        onSortingChange={() => {}}
      />,
    )
    const button = screen.getByRole("button", { name: /Email/ })
    expect(button.tagName).toBe("BUTTON")
    const header = screen.getByRole("columnheader", { name: /Email/ })
    expect(header.getAttribute("aria-sort")).toBe("ascending")
    expect(header.getAttribute("aria-labelledby")).toBe(button.id)
    expect(screen.getByRole("columnheader", { name: /Email/ }).textContent ?? "").not.toMatch(
      /\d{2,}/,
    )
  })

  it("keeps the resize sliders keyboard reachable", () => {
    render(
      <StudentsTable
        columns={columns}
        data={[{ email: "a@example.com" }]}
        sorting={[]}
        onSortingChange={() => {}}
      />,
    )
    const sliders = screen.queryAllByRole("slider")
    expect(sliders.length).toBeGreaterThan(0)
    for (const slider of sliders) {
      expect(slider.getAttribute("tabindex")).toBe("0")
    }
  })

  it("names a header with spaces in its id by its label only", () => {
    render(
      <StudentsTable
        columns={[{ id: "Describing data", header: "Describing data", enableSorting: true }]}
        data={[{ email: "a@example.com" }]}
        sorting={[]}
        onSortingChange={() => {}}
      />,
    )
    const header = screen.getByRole("columnheader", { name: /Describing data/ })
    const labelledBy = header.getAttribute("aria-labelledby") ?? ""
    expect(labelledBy).not.toMatch(/\s/)
    expect(document.querySelector(`[id="${labelledBy}"]`)).not.toBeNull()
  })
})
