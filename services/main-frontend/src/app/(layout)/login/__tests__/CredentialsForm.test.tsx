"use client"

import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

import { CredentialsForm } from "../CredentialsForm"

jest.mock("next/navigation", () => ({
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
}))

const noop = async () => {
  /* no-op */
}

describe("CredentialsForm error live region", () => {
  it("keeps the aria-live region in the DOM before any error appears", () => {
    const { container } = render(
      <CredentialsForm onSubmit={noop} error={false} isSubmitting={false} />,
    )
    const liveRegion = container.querySelector('[aria-live="assertive"]')
    expect(liveRegion).not.toBeNull()
    expect(liveRegion).toBeEmptyDOMElement()
  })

  it("populates the pre-existing live region when the error appears", () => {
    const { container, rerender } = render(
      <CredentialsForm onSubmit={noop} error={false} isSubmitting={false} />,
    )
    const liveRegionBefore = container.querySelector('[aria-live="assertive"]')
    expect(liveRegionBefore).not.toBeNull()

    rerender(<CredentialsForm onSubmit={noop} error={true} isSubmitting={false} />)

    const liveRegionAfter = container.querySelector('[aria-live="assertive"]')
    // The live region element must not be re-created when the error appears.
    expect(liveRegionAfter).toBe(liveRegionBefore)
    expect(liveRegionAfter).toHaveTextContent("incorrect-email-or-password")
  })
})
