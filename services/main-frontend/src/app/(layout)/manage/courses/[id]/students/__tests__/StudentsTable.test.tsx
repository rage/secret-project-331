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

  it("keeps the resize sliders out of the tab order", () => {
    render(
      <StudentsTable
        columns={columns}
        data={[{ email: "a@example.com" }]}
        sorting={[]}
        onSortingChange={() => {}}
      />,
    )
    for (const slider of screen.queryAllByRole("slider")) {
      expect(slider.getAttribute("tabindex")).toBe("-1")
    }
  })
})
