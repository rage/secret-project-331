"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import TableBlock from "../TableBlock"

const makeProps = (attributes: Record<string, unknown>) =>
  ({
    id: "table-block",
    data: {
      name: "core/table",
      isValid: true,
      clientId: "table-block",
      innerBlocks: [],
      attributes: { hasFixedLayout: false, caption: "", body: [], ...attributes },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

describe("TableBlock spans (N-06)", () => {
  it("omits colspan and rowspan when unset and keeps valid ones", () => {
    const { container } = render(
      <TableBlock
        {...makeProps({
          body: [
            {
              cells: [
                { content: "A", tag: "td", colspan: "2", rowspan: "3" },
                { content: "B", tag: "td", colspan: "", rowspan: "x" },
                { content: "C", tag: "td" },
              ],
            },
          ],
        })}
      />,
    )

    const cells = container.querySelectorAll("tbody td")
    expect(cells[0]).toHaveAttribute("colspan", "2")
    expect(cells[0]).toHaveAttribute("rowspan", "3")
    for (const cell of [cells[1], cells[2]]) {
      expect(cell).not.toHaveAttribute("colspan")
      expect(cell).not.toHaveAttribute("rowspan")
    }
    expect(container.innerHTML).not.toContain("NaN")
  })
})

describe("TableBlock scroll region (F-23)", () => {
  const descriptors = {
    scrollWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth"),
    clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"),
  }

  afterEach(() => {
    for (const key of ["scrollWidth", "clientWidth"] as const) {
      const descriptor = descriptors[key]
      if (descriptor) {
        Object.defineProperty(HTMLElement.prototype, key, descriptor)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, key)
      }
    }
  })

  const body = [{ cells: [{ content: "A", tag: "td" }] }]

  it("makes an overflowing wrapper focusable and named by the caption", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => 600,
    })
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 200,
    })
    render(<TableBlock {...makeProps({ body, caption: "Population by year" })} />)

    const region = screen.getByRole("region", { name: "Population by year" })
    expect(region).toHaveAttribute("tabindex", "0")
  })

  it("adds no tab stop when the table fits", () => {
    const { container } = render(<TableBlock {...makeProps({ body, caption: "Fits" })} />)
    expect(container.querySelector("[tabindex]")).toBeNull()
    expect(screen.queryByRole("region")).toBeNull()
  })
})
