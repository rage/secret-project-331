"use client"

import { fireEvent, screen } from "@testing-library/react"

import { Pagination } from "../src/components/Pagination"
import type { PaginationProps } from "../src/components/Pagination"
import { renderUi } from "./testUtils"

function renderPagination(props?: Partial<PaginationProps>) {
  const onPageChange = jest.fn()
  const rendered = renderUi(
    <Pagination
      itemsPerPage={50}
      onPageChange={onPageChange}
      page={1}
      totalItems={211}
      totalPages={5}
      {...props}
    />,
  )
  return { ...rendered, onPageChange }
}

describe("Pagination", () => {
  test("renders nothing at all for a single page or an empty result", () => {
    const { container, unmount } = renderPagination({ totalPages: 1 })
    expect(container).toBeEmptyDOMElement()
    unmount()

    expect(renderPagination({ totalPages: 0, totalItems: 0 }).container).toBeEmptyDOMElement()
  })

  test("says which rows are on screen out of how many", () => {
    renderPagination({ page: 2 })

    expect(screen.getByText("Showing 51–100 of 211")).toBeInTheDocument()
  })

  test("clamps the last page's range to the row count", () => {
    renderPagination({ page: 5 })

    expect(screen.getByText("Showing 201–211 of 211")).toBeInTheDocument()
  })

  test("falls back to the page number when the row count is unknown", () => {
    renderUi(<Pagination itemsPerPage={50} onPageChange={jest.fn()} page={3} totalPages={5} />)

    expect(screen.getByText("Page 3 of 5")).toBeInTheDocument()
  })

  test("offers every page as a real button and marks the current one", () => {
    renderPagination({ page: 3 })

    const current = screen.getByRole("button", { name: "Current page: 3" })
    expect(current.tagName).toBe("BUTTON")
    expect(current).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "Go to page 4" })).not.toHaveAttribute("aria-current")
  })

  test("reports the page a press asks for", () => {
    const { onPageChange } = renderPagination({ page: 3 })

    fireEvent.click(screen.getByRole("button", { name: "Go to page 4" }))
    expect(onPageChange).toHaveBeenCalledWith(4)

    fireEvent.click(screen.getByRole("button", { name: "Go to previous page" }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  test("disables the arrow that would leave the range", () => {
    const { unmount } = renderPagination({ page: 1 })
    expect(screen.getByRole("button", { name: "Go to previous page" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Go to next page" })).not.toBeDisabled()
    unmount()

    renderPagination({ page: 5 })

    expect(screen.getByRole("button", { name: "Go to next page" })).toBeDisabled()
  })

  test("collapses a long page list around the current page", () => {
    renderPagination({ page: 20, totalPages: 40, totalItems: 2000 })

    for (const page of [1, 19, 20, 21, 40]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`page: ${page}$|page ${page}$`) }),
      ).toBeInTheDocument()
    }
    expect(screen.queryByRole("button", { name: "Go to page 10" })).not.toBeInTheDocument()
  })

  test("offers the page size only when the caller can change it", () => {
    const { unmount } = renderPagination()
    expect(screen.queryByRole("button", { name: "50 / page" })).not.toBeInTheDocument()
    unmount()

    renderPagination({ onItemsPerPageChange: jest.fn() })

    expect(screen.getByRole("button", { name: "50 / page" })).toBeInTheDocument()
  })

  test("keeps a page size from outside its own list selectable", () => {
    renderPagination({ itemsPerPage: 500, onItemsPerPageChange: jest.fn() })

    fireEvent.click(screen.getByRole("button", { name: "500 / page" }))

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "25 / page",
      "50 / page",
      "100 / page",
      "500 / page",
    ])
  })

  test("reports a page size the reader picks", () => {
    const onItemsPerPageChange = jest.fn()
    renderPagination({ onItemsPerPageChange })

    fireEvent.click(screen.getByRole("button", { name: "50 / page" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "25 / page" }))

    expect(onItemsPerPageChange).toHaveBeenCalledWith(25)
  })
})
