"use client"

import { screen } from "@testing-library/react"

import type { TableColumn, TableProps } from "../src/components/Table"
import { Table } from "../src/components/Table"
import { domClick, renderUi } from "./testUtils"

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

  test("takes className on the frame and scrolls sideways in the container inside it", () => {
    const { container } = renderTable({ className: "table-root" })

    const root = container.querySelector(".table-root")
    expect(root?.tagName).toBe("DIV")
    const scroller = root?.querySelector("div")
    expect(getComputedStyle(scroller!).overflowX).toBe("auto")
    expect(scroller?.querySelector("table")).not.toBeNull()
  })

  test("says something instead of showing headers alone when there are no rows", () => {
    renderTable({ rows: [] })

    expect(screen.getByRole("cell", { name: "Nothing to show" })).toHaveAttribute(
      "colspan",
      String(columns.length),
    )
  })

  test("shows headers alone only when the empty state is explicitly nothing", () => {
    renderTable({ rows: [], emptyState: null })

    expect(screen.getAllByRole("row")).toHaveLength(1)
    expect(screen.queryByRole("cell")).not.toBeInTheDocument()
  })

  test("fills the body with the empty state when there are no rows", () => {
    renderTable({ rows: [], emptyState: "No completions yet" })

    expect(screen.getByRole("cell", { name: "No completions yet" })).toHaveAttribute(
      "colspan",
      String(columns.length),
    )
  })

  test("lays itself out as an auto table until a column asks for a width", () => {
    const { container } = renderTable()

    expect(getComputedStyle(container.querySelector("table")!).tableLayout).not.toBe("fixed")
    expect(container.querySelector("colgroup")).toBeNull()
  })

  test("switches to a fixed layout and declares the widths when a column asks for one", () => {
    const { container } = renderTable({
      columns: [
        { header: "Module", cell: (row) => row.module, grow: true },
        { header: "Credits", cell: (row) => row.credits, width: "6rem" },
      ],
    })

    expect(getComputedStyle(container.querySelector("table")!).tableLayout).toBe("fixed")
    const cols = container.querySelectorAll("col")
    expect(getComputedStyle(cols[0]!).width).toBe("auto")
    expect(getComputedStyle(cols[1]!).width).toBe("6rem")
  })

  test("lets a growing column take the slack while the table is still auto-layout", () => {
    const { container } = renderTable({
      columns: [
        { header: "Module", cell: (row) => row.module, grow: true },
        { header: "Credits", cell: (row) => row.credits },
      ],
    })

    expect(getComputedStyle(container.querySelector("table")!).tableLayout).not.toBe("fixed")
    expect(getComputedStyle(container.querySelectorAll("col")[0]!).width).toBe("100%")
  })

  test("puts a numeric minWidth on the column in pixels", () => {
    renderTable({
      columns: [
        { header: "Module", cell: (row) => row.module, minWidth: 224 },
        { header: "Credits", cell: (row) => row.credits },
      ],
    })

    expect(getComputedStyle(screen.getByRole("columnheader", { name: "Module" })).minWidth).toBe(
      "224px",
    )
    expect(getComputedStyle(screen.getByRole("cell", { name: "Part 1" })).minWidth).toBe("224px")
  })

  test("keeps a header on one line by default and wraps it when the column says so", () => {
    renderTable({
      columns: [
        { header: "Module", cell: (row) => row.module, nowrap: false },
        { header: "Credits", cell: (row) => row.credits },
      ],
    })

    expect(getComputedStyle(screen.getByRole("columnheader", { name: "Module" })).whiteSpace).toBe(
      "normal",
    )
    expect(getComputedStyle(screen.getByRole("columnheader", { name: "Credits" })).whiteSpace).toBe(
      "nowrap",
    )
  })

  test("keeps a nowrap column's cells on one line", () => {
    renderTable({
      columns: [
        { header: "Module", cell: (row) => row.module },
        { header: "Credits", cell: (row) => row.credits, nowrap: true },
      ],
    })

    expect(getComputedStyle(screen.getByRole("cell", { name: "5" })).whiteSpace).toBe("nowrap")
    expect(getComputedStyle(screen.getByRole("cell", { name: "Part 1" })).whiteSpace).not.toBe(
      "nowrap",
    )
  })

  test("splits the slack between growing columns in proportion to their weights", () => {
    const { container } = renderTable({
      columns: [
        { header: "Module", cell: (row) => row.module, grow: 2 },
        { header: "Credits", cell: (row) => row.credits, grow: 1 },
      ],
    })

    const cols = container.querySelectorAll("col")
    expect(getComputedStyle(cols[0]!).width).toBe("66.6667%")
    expect(getComputedStyle(cols[1]!).width).toBe("33.3333%")
  })

  test("fades both edges only once there is something to scroll to", () => {
    const { container } = renderTable()

    const masks = container.querySelectorAll('span[aria-hidden="true"]')
    expect(masks).toHaveLength(2)
    for (const mask of masks) {
      expect(getComputedStyle(mask).opacity).toBe("0")
    }
  })

  test("leaves out the overflow cue when the caller turns it off", () => {
    const { container } = renderTable({ overflowCue: false })

    expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(0)
  })

  test("pins the first column when asked and leaves it alone otherwise", () => {
    const { unmount } = renderTable()
    expect(getComputedStyle(screen.getByRole("cell", { name: "Part 1" })).position).not.toBe(
      "sticky",
    )
    unmount()

    renderTable({ stickyFirstColumn: true })

    expect(getComputedStyle(screen.getByRole("cell", { name: "Part 1" })).position).toBe("sticky")
    expect(getComputedStyle(screen.getByRole("cell", { name: "5" })).position).not.toBe("sticky")
  })

  test("makes a sortable header a button, reports its direction, and asks for the opposite", () => {
    const onSort = jest.fn()
    renderTable({
      columns: [
        { header: "Module", cell: (row) => row.module, onSort, sortDirection: "ascending" },
        { header: "Credits", cell: (row) => row.credits },
      ],
    })

    expect(screen.getByRole("columnheader", { name: "Module" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    )
    expect(screen.getByRole("columnheader", { name: "Credits" })).not.toHaveAttribute("aria-sort")

    domClick(screen.getByRole("button", { name: "Module" }))

    expect(onSort).toHaveBeenCalledWith("descending")
  })

  test("reveals a row's detail from a toggle that says which row it controls", () => {
    renderTable({ expandableRow: (row) => (row.id === "a" ? "Graded on 1 May" : null) })

    expect(screen.getAllByRole("button", { name: "Show more" })).toHaveLength(1)
    const toggle = screen.getByRole("button", { name: "Show more" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("cell", { name: "Graded on 1 May" })).not.toBeInTheDocument()

    domClick(toggle)

    const detail = screen.getByRole("cell", { name: "Graded on 1 May" })
    expect(detail).toHaveAttribute("id", toggle.getAttribute("aria-controls"))
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
  })

  test("picks every selectable row from the header checkbox and passes over the rest", () => {
    const onChange = jest.fn()
    renderTable({
      selection: {
        selectedKeys: [],
        onChange,
        isRowSelectable: (row) => row.id === "a",
      },
    })

    const [selectAll, firstRow, secondRow] = screen.getAllByRole("checkbox")
    expect(secondRow).toBeDisabled()
    expect(firstRow).not.toBeDisabled()

    domClick(selectAll!)

    expect(onChange).toHaveBeenCalledWith(new Set(["a"]))
  })

  test("marks the header checkbox indeterminate while only some rows are picked", () => {
    renderTable({ selection: { selectedKeys: ["a"], onChange: jest.fn() } })

    const [selectAll] = screen.getAllByRole("checkbox")
    expect((selectAll as HTMLInputElement).indeterminate).toBe(true)
    expect((selectAll as HTMLInputElement).checked).toBe(false)
  })

  test("keeps table semantics and labels every cell when it can stack", () => {
    const { container } = renderTable({ responsive: "stack" })

    expect(container.querySelector("table")).toHaveAttribute("role", "table")
    expect(container.querySelectorAll('[data-table-stack-label="true"]')).toHaveLength(
      rows.length * columns.length,
    )
    // The visible label repeats the real column header, so it stays out of the accessible name.
    expect(screen.getByRole("cell", { name: "Part 1" })).toHaveTextContent("ModulePart 1")
  })
  test("tightens the cells at compact density", () => {
    const { unmount } = renderTable()
    const comfortable = getComputedStyle(screen.getByRole("cell", { name: "Part 1" })).padding
    unmount()

    renderTable({ density: "compact" })

    expect(comfortable).not.toBe("")
    expect(getComputedStyle(screen.getByRole("cell", { name: "Part 1" })).padding).not.toBe(
      comfortable,
    )
  })
})
