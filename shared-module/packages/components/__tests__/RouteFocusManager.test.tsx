"use client"

import { act, render } from "@testing-library/react"
import React from "react"

import RouteFocusManager, { focusMainHeading } from "../src/components/RouteFocusManager"

const mockState = { pathname: "/" }

function Page({
  heading,
  children,
}: {
  heading?: string | null | undefined
  children?: React.ReactNode
}) {
  return (
    <main id="maincontent">
      {heading ? <h1>{heading}</h1> : null}
      {children}
    </main>
  )
}

function Shell({ children, pathname }: { children?: React.ReactNode; pathname: string }) {
  return (
    <>
      <RouteFocusManager pathname={pathname} />
      <main id="maincontent">{children}</main>
    </>
  )
}

function App({ heading, children }: { heading?: string | null; children?: React.ReactNode }) {
  return (
    <>
      <RouteFocusManager pathname={mockState.pathname} />
      <Page heading={heading}>{children}</Page>
    </>
  )
}

function Swap({ swapped, children }: { swapped: boolean; children?: React.ReactNode }) {
  return swapped ? (
    <div>
      <main id="maincontent">{children}</main>
    </div>
  ) : (
    <main id="maincontent">{children}</main>
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

  test("falls back to the first heading when the page has no h1", () => {
    const { rerender } = render(<App heading="Home" />)

    mockState.pathname = "/h2-page"
    rerender(
      <App heading={null}>
        <p>intro</p>
        <h3 id="first">First</h3>
        <h2>Second</h2>
      </App>,
    )

    expect(document.activeElement).toBe(document.querySelector("#first"))
  })

  test("prefers the h1 over earlier headings", () => {
    const { rerender } = render(<App heading="Home" />)

    mockState.pathname = "/mixed"
    rerender(
      <App heading="Title">
        <h2>Later</h2>
      </App>,
    )

    expect(document.activeElement).toBe(document.querySelector("h1"))
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

  test("marks the focused heading so the injected rule can suppress its outline", () => {
    const { rerender } = render(<App heading="Home" />)

    mockState.pathname = "/about"
    rerender(<App heading="About" />)

    const heading = document.querySelector("h1")
    expect(heading).toHaveAttribute("data-route-focus-manager-active", "")
  })

  test("clears the focus marker once the managed element loses focus", () => {
    const { rerender } = render(<App heading="Home" />)

    mockState.pathname = "/about"
    rerender(<App heading="About" />)

    const heading = document.querySelector("h1")
    heading?.blur()
    expect(heading).not.toHaveAttribute("data-route-focus-manager-active")
  })

  test("does not re-mark an element that regains focus after a real user tab", () => {
    const { rerender } = render(<App heading="Home" />)

    mockState.pathname = "/about"
    rerender(<App heading="About" />)

    const heading = document.querySelector("h1")
    heading?.blur()
    heading?.focus()
    expect(heading).not.toHaveAttribute("data-route-focus-manager-active")
  })

  test("re-focuses when the focused h1 is replaced shortly after navigation", async () => {
    const { rerender } = render(<Shell pathname="/" />)
    rerender(
      <Shell pathname="/chapter">
        <h1 key="a">Chapter</h1>
      </Shell>,
    )
    const first = document.querySelector("h1")
    expect(document.activeElement).toBe(first)

    // The page remounts its content after load, so the focused h1 is a new element.
    await act(async () => {
      rerender(
        <Shell pathname="/chapter">
          <h1 key="b">Chapter</h1>
        </Shell>,
      )
      await Promise.resolve()
    })
    const second = document.querySelector("h1")
    expect(second).not.toBe(first)
    expect(document.activeElement).toBe(second)
  })

  test("leaves focus alone once the user moved it, even if the h1 is replaced", async () => {
    const { rerender } = render(<Shell pathname="/" />)
    rerender(
      <Shell pathname="/chapter">
        <h1 key="a">Chapter</h1>
        <button type="button">Elsewhere</button>
      </Shell>,
    )
    const button = document.querySelector("button")
    button?.focus()
    await act(async () => {
      rerender(
        <Shell pathname="/chapter">
          <h1 key="b">Chapter</h1>
          <button type="button">Elsewhere</button>
        </Shell>,
      )
      await Promise.resolve()
    })
    expect(document.activeElement).toBe(button)
  })

  test("respects a custom target selector", () => {
    function CustomApp() {
      return (
        <>
          <RouteFocusManager pathname={mockState.pathname} targetSelector="#custom-root" />
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

  test("a focused link inside main that unmounts hands focus to the h1 that arrives later", async () => {
    const { rerender } = render(
      <Shell pathname="/">
        <button type="button">Course card</button>
      </Shell>,
    )
    const link = document.querySelector("button")
    link?.focus()
    expect(document.activeElement).toBe(link)

    // Route changes while the old page (and the focused link) is still mounted.
    mockState.pathname = "/course"
    rerender(
      <Shell pathname="/course">
        <button type="button">Course card</button>
      </Shell>,
    )
    expect(document.activeElement).toBe(link)

    await act(async () => {
      rerender(<Shell pathname="/course" />)
      await Promise.resolve()
    })
    const main = document.querySelector("#maincontent")
    expect(document.activeElement).toBe(main)

    await act(async () => {
      rerender(
        <Shell pathname="/course">
          <h1>Course</h1>
        </Shell>,
      )
      await Promise.resolve()
    })
    expect(document.activeElement).toBe(document.querySelector("h1"))
  })

  test("finds a heading that arrives in a replaced main element", async () => {
    const { rerender } = render(
      <>
        <RouteFocusManager pathname="/" />
        <Swap swapped={false} />
      </>,
    )
    mockState.pathname = "/chapter"
    rerender(
      <>
        <RouteFocusManager pathname="/chapter" />
        <Swap swapped={false} />
      </>,
    )
    await act(async () => {
      rerender(
        <>
          <RouteFocusManager pathname="/chapter" />
          <Swap swapped />
        </>,
      )
      await Promise.resolve()
    })
    await act(async () => {
      rerender(
        <>
          <RouteFocusManager pathname="/chapter" />
          <Swap swapped>
            <h3 id="late">Late</h3>
          </Swap>
        </>,
      )
      await Promise.resolve()
    })
    expect(document.activeElement).toBe(document.querySelector("#late"))
  })

  test("observes the layout root, not the body, so a mutation outside it does not refocus", async () => {
    const observe = jest.spyOn(MutationObserver.prototype, "observe")
    const { rerender } = render(<App heading="Home" />)
    mockState.pathname = "/about"
    rerender(<App heading={null} />)
    const main = document.querySelector("#maincontent")
    const observed = observe.mock.calls.map(([node]) => node)
    expect(observed).toContain(main?.parentElement)
    expect(observed).not.toContain(document.body)

    // Focus moved on; a toast outside the root must not pull it back.
    const button = document.createElement("button")
    document.body.append(button)
    button.focus()
    await act(async () => {
      const toast = document.createElement("div")
      toast.setAttribute("role", "status")
      document.body.append(toast)
      await Promise.resolve()
    })
    expect(document.activeElement).toBe(button)
    button.remove()
    observe.mockRestore()
  })

  test("focusMainHeading focuses without scrolling", () => {
    render(<Page heading="Title" />)
    const heading = document.querySelector("h1") as HTMLElement
    const focus = jest.spyOn(heading, "focus")
    focusMainHeading()
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    focus.mockRestore()
  })
})
