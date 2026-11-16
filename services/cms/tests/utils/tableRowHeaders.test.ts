import { hasRowHeaders, setRowHeaders } from "@/utils/Gutenberg/tableRowHeaders"

const body = () => [
  {
    cells: [
      { content: "A", tag: "td" },
      { content: "1", tag: "td" },
    ],
  },
  {
    cells: [
      { content: "B", tag: "td" },
      { content: "2", tag: "td" },
    ],
  },
]

describe("setRowHeaders", () => {
  it("turns the first body cell of every row into a th with scope row", () => {
    const result = setRowHeaders(body(), true)

    expect(result.map((row) => row.cells[0])).toEqual([
      { content: "A", tag: "th", scope: "row" },
      { content: "B", tag: "th", scope: "row" },
    ])
    expect(result.map((row) => row.cells[1]?.tag)).toEqual(["td", "td"])
    expect(hasRowHeaders(result)).toBe(true)
  })

  it("restores plain td cells and drops the scope", () => {
    const result = setRowHeaders(setRowHeaders(body(), true), false)

    expect(result).toEqual(body())
    expect(hasRowHeaders(result)).toBe(false)
  })

  it("does not mutate its input and handles an empty body", () => {
    const input = body()
    setRowHeaders(input, true)

    expect(input).toEqual(body())
    expect(setRowHeaders(undefined, true)).toEqual([])
    expect(hasRowHeaders([])).toBe(false)
  })
})
