"use client"

import { OneTimeCodeForm } from "../src/components/OneTimeCodeForm"
import { renderUi } from "./testUtils"

const noop = () => {
  /* no-op */
}

const LIVE_REGION_SELECTOR = '[aria-live="assertive"]'

describe("OneTimeCodeForm error live region", () => {
  it("keeps the aria-live region in the DOM before any error appears", () => {
    const { container } = renderUi(
      <OneTimeCodeForm
        message="Enter the code"
        onSubmit={noop}
        submitLabel="Verify"
        error={null}
      />,
    )
    const liveRegion = container.querySelector(LIVE_REGION_SELECTOR)
    expect(liveRegion).not.toBeNull()
    expect(liveRegion).toBeEmptyDOMElement()
  })

  it("populates the pre-existing live region when the error appears", () => {
    const { container, rerender } = renderUi(
      <OneTimeCodeForm
        message="Enter the code"
        onSubmit={noop}
        submitLabel="Verify"
        error={null}
      />,
    )
    const liveRegionBefore = container.querySelector(LIVE_REGION_SELECTOR)
    expect(liveRegionBefore).not.toBeNull()

    rerender(
      <OneTimeCodeForm
        message="Enter the code"
        onSubmit={noop}
        submitLabel="Verify"
        error="Invalid code"
      />,
    )

    const liveRegionAfter = container.querySelector(LIVE_REGION_SELECTOR)
    expect(liveRegionAfter).toBe(liveRegionBefore)
    expect(liveRegionAfter).toHaveTextContent("Invalid code")
  })
})
