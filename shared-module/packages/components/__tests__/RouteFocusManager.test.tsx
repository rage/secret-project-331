"use client"

import { render } from "@testing-library/react"
import React from "react"

import RouteFocusManager from "../src/components/RouteFocusManager"

const mockState = { pathname: "/" }

jest.mock("next/navigation", () => ({
  usePathname: () => mockState.pathname,
}))

function Page({ heading, children }: { heading?: string | null; children?: React.ReactNode }) {
  return (
    <main id="maincontent">
      {heading ? <h1>{heading}</h1> : null}
      {children}
    </main>
  )
}

function App({ heading, children }: { heading?: string | null; children?: React.ReactNode }) {
  return (
    <>
      <RouteFocusManager />
      <Page heading={heading}>{children}</Page>
    </>
  )
}

describe("RouteFocusManager", () => {
  beforeEach(() => {
    mockState.pathname = "/"
    window.location.hash = ""
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  })

  test("does not move focus on the initial (full) page load", () => {
    render(<App heading="Home" />)
    expect(document.activeElement).toBe(document.body)
  })

  test("focuses the main heading on client-side navigation and makes it focusable", () => {
    const { rerender } = render(<App heading="Home" />)

    mockState.pathname = "/about"
    rerender(<App heading="About" />)

    const heading = document.querySelector("h1")
    expect(heading).not.toBeNull()
    expect(heading).toHaveAttribute("tabindex", "-1")
    expect(document.activeElement).toBe(heading)
  })

  test("falls back to the main content container when the new page has no h1 yet", () => {
    const { rerender } = render(<App heading="Home" />)

    mockState.pathname = "/loading-page"
    rerender(<App heading={null} />)

    const main = document.querySelector("#maincontent")
    expect(main).toHaveAttribute("tabindex", "-1")
    expect(document.activeElement).toBe(main)
  })

  test("does not move focus again on re-renders without navigation", () => {
    const { rerender } = render(<App heading="Home" />)

    mockState.pathname = "/about"
    rerender(<App heading="About" />)
    expect(document.activeElement).toBe(document.querySelector("h1"))

    // Focus something else, then re-render on the same route: focus must stay put.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    rerender(<App heading="About" />)
    expect(document.activeElement).toBe(document.body)
  })

  test("skips the focus move when the URL has a fragment (in-page target owns focus)", () => {
    const { rerender } = render(<App heading="Home" />)

    window.location.hash = "#section-2"
    mockState.pathname = "/long-page"
    rerender(<App heading="Long page" />)

    expect(document.activeElement).toBe(document.body)
  })

  test("does not steal focus that the new page already placed inside the main content", () => {
    const { rerender } = render(
      <App heading="Home">
        <input aria-label="Search" />
      </App>,
    )

    mockState.pathname = "/search"
    rerender(
      <App heading="Search">
        <input aria-label="Search" />
      </App>,
    )
    const input = document.querySelector("input")
    input?.focus()
    mockState.pathname = "/search-2"
    rerender(
      <App heading="Search 2">
        <input aria-label="Search" />
      </App>,
    )
    expect(document.activeElement).toBe(input)
  })

  test("respects a custom target selector", () => {
    function CustomApp() {
      return (
        <>
          <RouteFocusManager targetSelector="#custom-root" />
          <div id="custom-root">
            <h1>Custom</h1>
          </div>
        </>
      )
    }
    const { rerender } = render(<CustomApp />)
    mockState.pathname = "/custom"
    rerender(<CustomApp />)
    expect(document.activeElement).toBe(document.querySelector("#custom-root h1"))
  })
})
