"use client"

import { render } from "@testing-library/react"

import NoIndexMeta from "../NoIndexMeta"

/** The robots meta is hoisted into <head> by React, so query it there rather than in the container. */
const robotsMeta = () => document.head.querySelector('meta[name="robots"]')

// No manual cleanup of the meta node: React owns the hoisted element and removes it when the
// component unmounts (testing-library's auto-cleanup between tests). Removing it by hand would
// make React's own removeChild on unmount throw.
describe("NoIndexMeta", () => {
  test("renders a noindex robots meta when noIndex is true", () => {
    render(<NoIndexMeta noIndex={true} />)
    expect(robotsMeta()?.getAttribute("content")).toBe("noindex")
  })

  test("renders nothing when noIndex is false", () => {
    render(<NoIndexMeta noIndex={false} />)
    expect(robotsMeta()).toBeNull()
  })

  test("removes the meta when the page stops being hidden (navigation to a visible page)", () => {
    const { rerender } = render(<NoIndexMeta noIndex={true} />)
    expect(robotsMeta()).not.toBeNull()

    rerender(<NoIndexMeta noIndex={false} />)
    expect(robotsMeta()).toBeNull()
  })

  test("adds the meta when navigating from a visible to a hidden page", () => {
    const { rerender } = render(<NoIndexMeta noIndex={false} />)
    expect(robotsMeta()).toBeNull()

    rerender(<NoIndexMeta noIndex={true} />)
    expect(robotsMeta()?.getAttribute("content")).toBe("noindex")
  })

  test("does not duplicate the meta when re-rendering while staying hidden", () => {
    const { rerender } = render(<NoIndexMeta noIndex={true} />)
    rerender(<NoIndexMeta noIndex={true} />)
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1)
  })
})
