"use client"

import { render, screen } from "@testing-library/react"

import DynamicImportErrorBoundary from "../DynamicImportErrorBoundary"

const ThrowingChild = () => {
  throw new Error("boom")
}

describe("DynamicImportErrorBoundary", () => {
  test("renders children when there is no error", () => {
    render(
      <DynamicImportErrorBoundary onError={jest.fn()}>
        <div>ok</div>
      </DynamicImportErrorBoundary>,
    )

    expect(screen.getByText("ok")).toBeInTheDocument()
  })

  test("shows fallback UI and calls onError when child throws", () => {
    const onError = jest.fn()

    render(
      <DynamicImportErrorBoundary onError={onError}>
        <ThrowingChild />
      </DynamicImportErrorBoundary>,
    )

    expect(
      screen.getByText("Something went wrong loading this part of the page."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument()
    expect(onError).toHaveBeenCalled()
  })
})
