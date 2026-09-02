"use client"

import { act, render, screen } from "@testing-library/react"

import { LoadingRegion, LoadingRegionNestedContext } from "../src/components/LoadingRegion"
import { testI18n } from "../tests/test-i18n"
import { renderUi } from "./testUtils"

testI18n.addResource("en", "shared-module", "spinner.loading", "Loading")

describe("LoadingRegion", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("is a role=status live region named by the default translation", () => {
    renderUi(<LoadingRegion delayMs={0} />)
    act(() => {
      jest.advanceTimersByTime(0)
    })

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
  })

  test("a custom label becomes the accessible name", () => {
    renderUi(<LoadingRegion delayMs={0} label="Loading students" />)
    act(() => {
      jest.advanceTimersByTime(0)
    })

    expect(screen.getByRole("status", { name: "Loading students" })).toBeInTheDocument()
  })

  test("showLabel renders the label as a visible caption too", () => {
    renderUi(<LoadingRegion delayMs={0} label="Loading students" showLabel />)
    act(() => {
      jest.advanceTimersByTime(0)
    })

    expect(screen.getByText("Loading students")).toBeInTheDocument()
  })

  test("without showLabel, the label is not rendered as visible text", () => {
    renderUi(<LoadingRegion delayMs={0} label="Loading students" />)
    act(() => {
      jest.advanceTimersByTime(0)
    })

    expect(screen.queryByText("Loading students")).not.toBeInTheDocument()
  })

  test("reserves minHeight from first paint, before the delay elapses", () => {
    renderUi(<LoadingRegion delayMs={1000} minHeight={200} />)

    const container = screen.getByTestId("loading-spinner-component")
    expect(getComputedStyle(container).minHeight).toBe("200px")
  })

  test("the delay withholds the live region and glyph entirely, not just visually", () => {
    renderUi(<LoadingRegion delayMs={250} label="Loading data" />)

    const container = screen.getByTestId("loading-spinner-component")
    expect(container).not.toHaveAttribute("role")
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(249)
    })
    expect(container).toBeEmptyDOMElement()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(screen.getByRole("status", { name: "Loading data" })).toBeInTheDocument()
    expect(container).not.toBeEmptyDOMElement()
  })

  test("nested inside another region's announcement, it renders its glyph without a second live region", () => {
    render(
      <LoadingRegionNestedContext.Provider value={true}>
        <LoadingRegion delayMs={0} label="Inner panel" data-testid="inner-region" />
      </LoadingRegionNestedContext.Provider>,
    )
    act(() => {
      jest.advanceTimersByTime(0)
    })

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    const container = screen.getByTestId("inner-region")
    expect(container).not.toHaveAttribute("role")
    expect(container).not.toBeEmptyDOMElement()
  })

  test("a custom data-testid replaces the default one", () => {
    renderUi(<LoadingRegion delayMs={0} data-testid="my-region" />)
    expect(screen.getByTestId("my-region")).toBeInTheDocument()
    expect(screen.queryByTestId("loading-spinner-component")).not.toBeInTheDocument()
  })
})
