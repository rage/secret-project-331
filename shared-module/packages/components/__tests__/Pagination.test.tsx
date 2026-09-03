"use client"

import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"

import { Pagination } from "../src/components/Pagination"
import { domClick, pressEnter, pressSpace } from "./testUtils"

const ELLIPSIS = "…"

function PaginationHarness({
  initialPage,
  totalPages,
}: {
  initialPage: number
  totalPages: number
}) {
  const [page, setPage] = React.useState(initialPage)
  return <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
}

/** The rendered page/ellipsis sequence between the prev and next controls, in DOM order. */
function renderedPageSequence(nav: HTMLElement): (number | typeof ELLIPSIS)[] {
  const list = nav.querySelector("ul")
  if (!list) {
    throw new Error("Pagination did not render a list")
  }
  return Array.from(list.children)
    .slice(1, -1)
    .map((item) => {
      if (item.getAttribute("aria-hidden") === "true") {
        return ELLIPSIS
      }
      return Number(item.querySelector("button")?.textContent)
    })
}

describe("Pagination - structure and naming", () => {
  test("renders nothing when totalPages is 1 or fewer", () => {
    const { rerender } = render(<Pagination page={1} totalPages={1} onPageChange={jest.fn()} />)
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()

    rerender(<Pagination page={1} totalPages={0} onPageChange={jest.fn()} />)
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  })

  test("nav landmark defaults to the translated label", () => {
    render(<Pagination page={1} totalPages={5} onPageChange={jest.fn()} />)
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument()
  })

  test("a caller-supplied label names the landmark instead", () => {
    render(
      <Pagination page={1} totalPages={5} onPageChange={jest.fn()} label="Course list pages" />,
    )
    expect(screen.getByRole("navigation", { name: "Course list pages" })).toBeInTheDocument()
  })

  test("aria-current marks only the current page's button", () => {
    render(<Pagination page={3} totalPages={5} onPageChange={jest.fn()} />)

    const current = screen.getByRole("button", { name: "Page 3" })
    expect(current).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "Go to page 1" })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("button", { name: "Go to page 5" })).not.toHaveAttribute("aria-current")
  })

  test("isDisabled disables every control but keeps the landmark", () => {
    render(<Pagination page={2} totalPages={5} onPageChange={jest.fn()} isDisabled />)

    expect(screen.getByRole("navigation")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Go to page 1" })).toBeDisabled()
  })

  test("puts data-testid on the nav", () => {
    render(
      <Pagination page={1} totalPages={5} onPageChange={jest.fn()} data-testid="results-pager" />,
    )

    expect(screen.getByTestId("results-pager")).toBe(screen.getByRole("navigation"))
  })
})

describe("Pagination - boundaries", () => {
  test("Previous is disabled on the first page, Next stays enabled", () => {
    render(<Pagination page={1} totalPages={5} onPageChange={jest.fn()} />)
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled()
  })

  test("Next is disabled on the last page, Previous stays enabled", () => {
    render(<Pagination page={5} totalPages={5} onPageChange={jest.fn()} />)
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled()
  })
})

describe("Pagination - keyboard interaction", () => {
  test("Enter on a page button reports that page", () => {
    const onPageChange = jest.fn()
    render(<Pagination page={1} totalPages={5} onPageChange={onPageChange} />)

    pressEnter(screen.getByRole("button", { name: "Go to page 4" }))
    expect(onPageChange).toHaveBeenCalledWith(4)
  })

  test("Space on Next reports the next page", () => {
    const onPageChange = jest.fn()
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} />)

    pressSpace(screen.getByRole("button", { name: "Next page" }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  test("Tab visits every enabled control in reading order", async () => {
    const user = userEvent.setup()
    render(<PaginationHarness initialPage={2} totalPages={3} />)

    await user.tab()
    expect(screen.getByRole("button", { name: "Previous page" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "Go to page 1" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "Go to page 3" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "Next page" })).toHaveFocus()
  })
})

describe("Pagination - live region", () => {
  test("stays empty on mount and announces after a page change", () => {
    render(<PaginationHarness initialPage={1} totalPages={5} />)

    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("")

    domClick(screen.getByRole("button", { name: "Next page" }))

    expect(screen.getByRole("status")).toHaveTextContent("Page 2 of 5")
  })
})

describe("Pagination - focus repair", () => {
  test("moving onto the last page returns focus to the new current page", () => {
    render(<PaginationHarness initialPage={2} totalPages={3} />)

    const next = screen.getByRole("button", { name: "Next page" })
    act(() => next.focus())
    domClick(next)

    expect(screen.getByRole("button", { name: "Page 3" })).toHaveFocus()
  })

  test("moving onto the first page returns focus to the new current page", () => {
    render(<PaginationHarness initialPage={2} totalPages={3} />)

    const prev = screen.getByRole("button", { name: "Previous page" })
    act(() => prev.focus())
    domClick(prev)

    expect(screen.getByRole("button", { name: "Page 1" })).toHaveFocus()
  })

  test("a non-boundary page change never moves focus away from the pressed control", () => {
    render(<PaginationHarness initialPage={2} totalPages={5} />)

    const next = screen.getByRole("button", { name: "Next page" })
    act(() => next.focus())
    domClick(next)

    expect(next).toHaveFocus()
  })

  test("falls back to the other nav control when the new current page isn't focusable", () => {
    render(<PaginationHarness initialPage={2} totalPages={3} />)

    // The compact form hides numbered buttons via a container query, which jsdom does not
    // evaluate; hiding this one directly stands in for "the pager is currently in compact form".
    const upcomingCurrent = screen.getByRole("button", { name: "Go to page 3" })
    upcomingCurrent.style.display = "none"

    const next = screen.getByRole("button", { name: "Next page" })
    act(() => next.focus())
    domClick(next)

    expect(screen.getByRole("button", { name: "Previous page" })).toHaveFocus()
  })
})

describe("Pagination - truncation", () => {
  test.each([
    [5, 3, [1, 2, 3, 4, 5]],
    [10, 5, [1, 2, 3, 4, 5, 6, 7, ELLIPSIS, 10]],
    [20, 10, [1, ELLIPSIS, 8, 9, 10, 11, 12, ELLIPSIS, 20]],
    [20, 1, [1, 2, 3, 4, 5, 6, 7, ELLIPSIS, 20]],
    [20, 20, [1, ELLIPSIS, 14, 15, 16, 17, 18, 19, 20]],
  ] as const)("totalPages=%i, page=%i", (totalPages, page, expected) => {
    render(<Pagination page={page} totalPages={totalPages} onPageChange={jest.fn()} />)
    expect(renderedPageSequence(screen.getByRole("navigation"))).toEqual([...expected])
  })

  test("the slot count is constant across a large totalPages regardless of the current page", () => {
    const widths = [1, 10, 20].map((page) => {
      const { unmount } = render(
        <Pagination page={page} totalPages={20} onPageChange={jest.fn()} />,
      )
      const width = screen.getByRole("navigation").querySelectorAll("ul > li").length
      unmount()
      return width
    })
    expect(widths).toEqual([11, 11, 11]) // 9 page/ellipsis slots plus Previous and Next
  })
})

describe("Pagination - compact form", () => {
  test("the compact status text and the full numbered list both exist in the same DOM", () => {
    render(<Pagination page={4} totalPages={12} onPageChange={jest.fn()} />)

    const nav = screen.getByRole("navigation")
    expect(screen.getByRole("button", { name: "Go to page 1" })).toBeInTheDocument()

    const describedBy = nav.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    // useId() ids contain ":", which querySelector would need escaping for.
    // oxlint-disable-next-line unicorn/prefer-query-selector
    const status = document.getElementById(describedBy ?? "")
    expect(status).toHaveTextContent("Page 4 of 12")
  })
})
