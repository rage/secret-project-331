"use client"

import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

import OneTimeCodeForm from "../OneTimeCodeForm"

const noop = () => {
  /* no-op */
}

describe("OneTimeCodeForm error live region", () => {
  it("keeps the aria-live region in the DOM before any error appears", () => {
    const { container } = render(
      <OneTimeCodeForm
        message="Enter the code"
        onSubmit={noop}
        submitLabel="Verify"
        error={null}
      />,
    )
    const liveRegion = container.querySelector("#code-error")
    expect(liveRegion).not.toBeNull()
    expect(liveRegion).toHaveAttribute("aria-live", "assertive")
    expect(liveRegion).toBeEmptyDOMElement()
  })

  it("populates the pre-existing live region when the error appears", () => {
    const { container, rerender } = render(
      <OneTimeCodeForm
        message="Enter the code"
        onSubmit={noop}
        submitLabel="Verify"
        error={null}
      />,
    )
    const liveRegionBefore = container.querySelector("#code-error")
    expect(liveRegionBefore).not.toBeNull()

    rerender(
      <OneTimeCodeForm
        message="Enter the code"
        onSubmit={noop}
        submitLabel="Verify"
        error="Invalid code"
      />,
    )

    const liveRegionAfter = container.querySelector("#code-error")
    expect(liveRegionAfter).toBe(liveRegionBefore)
    expect(liveRegionAfter).toHaveTextContent("Invalid code")
  })
})
