"use client"

import { act, screen } from "@testing-library/react"

import { Spinner } from "../src/components/Spinner"
import { renderUi } from "./testUtils"

describe("Spinner", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("without a label, it is aria-hidden and announces nothing", () => {
    renderUi(<Spinner delayMs={0} />)
    act(() => {
      jest.advanceTimersByTime(0)
    })

    const glyph = screen.getByTestId("loading-spinner-component")
    expect(glyph).toHaveAttribute("aria-hidden", "true")
    expect(glyph).not.toHaveAttribute("role")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  test("with a label, it is a named status region and the ring stays decorative", () => {
    renderUi(<Spinner delayMs={0} label="Loading results" />)
    act(() => {
      jest.advanceTimersByTime(0)
    })

    const status = screen.getByRole("status", { name: "Loading results" })
    expect(status).toHaveAttribute("data-testid", "loading-spinner-component")
    expect(status.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  test("the delay withholds rendering entirely, it does not just hide the glyph", () => {
    renderUi(<Spinner delayMs={250} />)

    expect(screen.queryByTestId("loading-spinner-component")).not.toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(249)
    })
    expect(screen.queryByTestId("loading-spinner-component")).not.toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(screen.getByTestId("loading-spinner-component")).toBeInTheDocument()
  })

  test("a custom data-testid replaces the default one", () => {
    renderUi(<Spinner delayMs={0} data-testid="my-spinner" />)
    act(() => {
      jest.advanceTimersByTime(0)
    })

    expect(screen.getByTestId("my-spinner")).toBeInTheDocument()
    expect(screen.queryByTestId("loading-spinner-component")).not.toBeInTheDocument()
  })
})
