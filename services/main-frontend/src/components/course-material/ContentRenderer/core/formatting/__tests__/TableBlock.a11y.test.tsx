"use client"

import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

import TableBlock from "../TableBlock"

// jsdom does not implement ResizeObserver, which TableBlock observes the scroll container with.
class ResizeObserverStub {
  public observe() {}
  public unobserve() {}
  public disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).ResizeObserver = ResizeObserverStub

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeProps = (): any => ({
  id: "table-block",
  data: {
    name: "core/table",
    isValid: true,
    clientId: "table-block",
    innerBlocks: [],
    attributes: {
      hasFixedLayout: false,
      caption: "",
      head: [
        {
          cells: [
            { content: "Name", tag: "th" },
            { content: "Value", tag: "th" },
          ],
        },
      ],
      body: [
        {
          cells: [
            { content: "Alpha", tag: "td" },
            { content: "1", tag: "td" },
          ],
        },
      ],
      foot: [
        {
          cells: [
            { content: "Total", tag: "th" },
            { content: "1", tag: "th" },
          ],
        },
      ],
    },
  },
})

describe("TableBlock accessibility (issue #91)", () => {
  it("adds scope=col to header cells in thead and tfoot", () => {
    const { container } = render(<TableBlock {...makeProps()} />)

    const headHeaders = container.querySelectorAll("thead th")
    expect(headHeaders.length).toBe(2)
    headHeaders.forEach((th) => expect(th).toHaveAttribute("scope", "col"))

    const footHeaders = container.querySelectorAll("tfoot th")
    expect(footHeaders.length).toBe(2)
    footHeaders.forEach((th) => expect(th).toHaveAttribute("scope", "col"))
  })

  it("does not mark body cells as header cells", () => {
    const { container } = render(<TableBlock {...makeProps()} />)

    const bodyCells = container.querySelectorAll("tbody td")
    expect(bodyCells.length).toBe(2)
    expect(container.querySelectorAll("tbody th").length).toBe(0)
  })

  it("renders a body cell tagged th with scope=row when no scope is provided", () => {
    const props = makeProps()
    props.data.attributes.body = [
      {
        cells: [
          { content: "Alpha", tag: "th" },
          { content: "1", tag: "td" },
        ],
      },
    ]
    const { container } = render(<TableBlock {...props} />)

    const bodyHeaders = container.querySelectorAll("tbody th")
    expect(bodyHeaders.length).toBe(1)
    expect(bodyHeaders[0]).toHaveAttribute("scope", "row")

    const bodyCells = container.querySelectorAll("tbody td")
    expect(bodyCells.length).toBe(1)
  })

  it("keeps an explicit scope on a body th cell", () => {
    const props = makeProps()
    props.data.attributes.body = [
      {
        cells: [
          { content: "Alpha", tag: "th", scope: "rowgroup" },
          { content: "1", tag: "td" },
        ],
      },
    ]
    const { container } = render(<TableBlock {...props} />)

    const bodyHeaders = container.querySelectorAll("tbody th")
    expect(bodyHeaders.length).toBe(1)
    expect(bodyHeaders[0]).toHaveAttribute("scope", "rowgroup")
  })
})
