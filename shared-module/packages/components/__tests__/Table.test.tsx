"use client"

import { screen } from "@testing-library/react"

import type { TableColumn, TableProps } from "../src/components/Table"
import { Table } from "../src/components/Table"
import { renderUi } from "./testUtils"

interface Row {
  id: string
  module: string
  credits: string
}

const rows: Row[] = [
  { id: "a", module: "Part 1", credits: "5" },
  { id: "b", module: "Part 2", credits: "—" },
]

const columns: TableColumn<Row>[] = [
  { header: "Module", cell: (row) => row.module },
  { header: "Credits", cell: (row) => row.credits, align: "end" },
]

function renderTable(props?: Partial<TableProps<Row>>) {
  return renderUi(
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption="Completions"
      {...props}
    />,
  )
}

describe("Table", () => {
  test("names the table with a caption that is hidden from sight but not from assistive tech", () => {
    const { container } = renderTable()

    expect(screen.getByRole("table")).toHaveAccessibleName("Completions")
    const caption = container.querySelector("caption")
    expect(caption).toHaveTextContent("Completions")
    expect(getComputedStyle(caption!).position).toBe("absolute")
  })

  test("shows the caption in place when asked", () => {
    const { container } = renderTable({ showCaption: true })

    const caption = container.querySelector("caption")
    expect(screen.getByRole("table")).toHaveAccessibleName("Completions")
    expect(getComputedStyle(caption!).position).not.toBe("absolute")
  })

  test("gives every column a scoped column header and every row its cells", () => {
    renderTable()

    expect(screen.getByRole("columnheader", { name: "Module" })).toHaveAttribute("scope", "col")
    expect(screen.getByRole("columnheader", { name: "Credits" })).toHaveAttribute("scope", "col")
    expect(screen.getAllByRole("row")).toHaveLength(rows.length + 1)
    expect(screen.getByRole("cell", { name: "Part 2" })).toBeInTheDocument()
  })

  test("keeps header and body rows in real thead/tbody sections", () => {
    const { container } = renderTable()

    expect(container.querySelectorAll("thead > tr > th")).toHaveLength(columns.length)
    expect(container.querySelectorAll("tbody > tr")).toHaveLength(rows.length)
  })

  test("aligns a column's header and its cells the same way", () => {
    renderTable()

    expect(getComputedStyle(screen.getByRole("columnheader", { name: "Credits" })).textAlign).toBe(
      "end",
    )
    expect(getComputedStyle(screen.getByRole("cell", { name: "5" })).textAlign).toBe("end")
    expect(getComputedStyle(screen.getByRole("columnheader", { name: "Module" })).textAlign).toBe(
      "start",
    )
  })

  test("scrolls sideways in its own container, which is where className lands", () => {
    const { container } = renderTable({ className: "table-root" })

    const root = container.querySelector(".table-root")
    expect(root?.tagName).toBe("DIV")
    expect(getComputedStyle(root!).overflowX).toBe("auto")
    expect(root?.querySelector("table")).not.toBeNull()
  })

  test("renders nothing but headers when there are no rows", () => {
    renderTable({ rows: [] })

    expect(screen.getAllByRole("row")).toHaveLength(1)
    expect(screen.queryByRole("cell")).not.toBeInTheDocument()
  })

  test("puts data-testid on the scroll container and every row key on its row", () => {
    renderTable({ "data-testid": "completions-table" })

    const root = screen.getByTestId("completions-table")
    expect(root.tagName).toBe("DIV")
    expect(root.querySelector('[data-row-key="b"]')?.tagName).toBe("TR")
  })
})
