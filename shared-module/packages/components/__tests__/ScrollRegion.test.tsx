"use client"

import { screen } from "@testing-library/react"

import { ScrollRegion } from "../src/components/ScrollRegion"
import { renderUi } from "./testUtils"

const setWidths = (scrollWidth: number, clientWidth: number) => {
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get: () => scrollWidth,
  })
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => clientWidth,
  })
}

describe("ScrollRegion", () => {
  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollWidth")
    Reflect.deleteProperty(HTMLElement.prototype, "clientWidth")
  })

  test("is a named tab stop while it overflows", () => {
    setWidths(600, 200)
    const onOverflowChange = jest.fn()
    renderUi(
      <ScrollRegion label="Results" onOverflowChange={onOverflowChange}>
        <table />
      </ScrollRegion>,
    )
    expect(screen.getByRole("region", { name: "Results" })).toHaveAttribute("tabindex", "0")
    expect(onOverflowChange).toHaveBeenLastCalledWith({ start: false, end: true })
  })

  test("is a plain box when the content fits", () => {
    setWidths(200, 200)
    const { container } = renderUi(
      <ScrollRegion label="Results" data-testid="scroller">
        <table />
      </ScrollRegion>,
    )
    expect(screen.queryByRole("region")).toBeNull()
    expect(container.querySelector("[tabindex]")).toBeNull()
    expect(screen.getByTestId("scroller")).not.toHaveAttribute("aria-label")
  })
})
