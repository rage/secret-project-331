"use client"

import { act, render } from "@testing-library/react"
import { Provider } from "jotai"
import React from "react"

import PageTitleManager from "../../components/PageTitle/PageTitleManager"
import { usePageTitle } from "../usePageTitle"

const mockState = { pathname: "/" }
const mockAnnounce = jest.fn()

jest.mock("next/navigation", () => ({
  usePathname: () => mockState.pathname,
}))

jest.mock("@react-aria/live-announcer", () => ({
  announce: (...args: unknown[]) => mockAnnounce(...args),
}))

const SITE = "Test Site"

function TitleSetter({ title, order }: { title: string | null; order?: number }) {
  usePageTitle(title, order !== undefined ? { order } : undefined)
  return null
}

/** Registers under an explicit, shared `key` so several instances contend for the same slot. */
function KeyedTitleSetter({ title, sharedKey }: { title: string; sharedKey: string }) {
  usePageTitle(title, { key: sharedKey })
  return null
}

/**
 * Two callers contending for the same registry key. The "Second" caller is kept at a STABLE
 * position so toggling `showFirst` off unmounts only the first caller while the second instance
 * is preserved (same identity, no re-registration) — exactly the case the owner check guards.
 */
function SharedKeyPair({ showFirst }: { showFirst: boolean }) {
  return (
    <>
      {showFirst ? <KeyedTitleSetter title="First" sharedKey="shared" /> : null}
      <KeyedTitleSetter title="Second" sharedKey="shared" />
    </>
  )
}

/** Renders a stable Provider + manager wrapper so rerenders keep the same jotai store. */
function App({ children }: { children?: React.ReactNode }) {
  return (
    <Provider>
      <PageTitleManager siteName={SITE} />
      {children}
    </Provider>
  )
}

describe("usePageTitle + PageTitleManager", () => {
  beforeEach(() => {
    mockState.pathname = "/"
    mockAnnounce.mockClear()
  })

  afterEach(() => {
    // jsdom persists document.title across cases.
    document.title = ""
  })

  test("sets document.title to '<page> - <site>' for a registered title", () => {
    render(
      <App>
        <TitleSetter title="Course X" />
      </App>,
    )
    expect(document.title).toBe("Course X - Test Site")
  })

  test("falls back to the bare site name when nothing is registered", () => {
    render(<App />)
    expect(document.title).toBe("Test Site")
  })

  test("updates the title when the page passes a new string (e.g. language change)", () => {
    const { rerender } = render(
      <App>
        <TitleSetter title="Settings" />
      </App>,
    )
    expect(document.title).toBe("Settings - Test Site")

    rerender(
      <App>
        <TitleSetter title="Asetukset" />
      </App>,
    )
    expect(document.title).toBe("Asetukset - Test Site")
  })

  test("deepest (highest order) title wins and reverts to the parent on leaf unmount", () => {
    const { rerender } = render(
      <App>
        <TitleSetter title="Manage" order={0} />
        <TitleSetter title="Course X" order={10} />
      </App>,
    )
    expect(document.title).toBe("Course X - Test Site")

    // Leaf unmounts (navigating within the same layout) -> falls back to the parent, not bare site.
    rerender(
      <App>
        <TitleSetter title="Manage" order={0} />
      </App>,
    )
    expect(document.title).toBe("Manage - Test Site")
  })

  test("at the same order, the most recently registered title wins", () => {
    render(
      <App>
        <TitleSetter title="First" order={5} />
        <TitleSetter title="Second" order={5} />
      </App>,
    )
    expect(document.title).toBe("Second - Test Site")
  })

  test("re-rendering one equal-order source does not let it jump ahead of a later-registered sibling", () => {
    // The leaf is registered after the parent at the same order, so it wins.
    const { rerender } = render(
      <App>
        <TitleSetter title="Parent" order={0} />
        <TitleSetter title="Leaf" order={0} />
      </App>,
    )
    expect(document.title).toBe("Leaf - Test Site")

    // Only the parent's title changes (so only it re-registers). Its `seq` must stay stable, so
    // the later-registered leaf keeps winning rather than the parent jumping the queue.
    rerender(
      <App>
        <TitleSetter title="Parent updated" order={0} />
        <TitleSetter title="Leaf" order={0} />
      </App>,
    )
    expect(document.title).toBe("Leaf - Test Site")
  })

  test("an unmounting caller does not delete a shared key that another caller still owns", () => {
    const { rerender } = render(
      <App>
        <SharedKeyPair showFirst={true} />
      </App>,
    )
    // Last writer wins the shared slot.
    expect(document.title).toBe("Second - Test Site")

    // The first (non-owning) caller unmounts; the second caller stays mounted at the same
    // position and owns the slot, so the first's cleanup must not delete it.
    rerender(
      <App>
        <SharedKeyPair showFirst={false} />
      </App>,
    )
    expect(document.title).toBe("Second - Test Site")
  })

  test("a blank/null title registers nothing, so a parent title is not blanked out", () => {
    render(
      <App>
        <TitleSetter title="Manage" order={0} />
        <TitleSetter title={null} order={10} />
      </App>,
    )
    expect(document.title).toBe("Manage - Test Site")
  })

  test("layout course-name baseline shows while the leaf loads, then the leaf title overrides it", () => {
    // Mirrors the course-material rollout: the section layout registers the course name at order 0
    // and the leaf page registers its own title at order 10 (null until its data resolves).
    const { rerender } = render(
      <App>
        <TitleSetter title="Programming 101" order={0} />
        <TitleSetter title={null} order={10} />
      </App>,
    )
    // While the leaf page is loading, the tab shows the layout's course-name baseline.
    expect(document.title).toBe("Programming 101 - Test Site")

    // The leaf's data resolves; its specific page title wins over the baseline.
    rerender(
      <App>
        <TitleSetter title="Programming 101" order={0} />
        <TitleSetter title="Introduction to Loops" order={10} />
      </App>,
    )
    expect(document.title).toBe("Introduction to Loops - Test Site")

    // Navigating away from the leaf (it unmounts) falls back to the baseline, not the bare site.
    rerender(
      <App>
        <TitleSetter title="Programming 101" order={0} />
      </App>,
    )
    expect(document.title).toBe("Programming 101 - Test Site")
  })

  test("the manager renders no live region of its own", () => {
    const { container } = render(
      <App>
        <TitleSetter title="X" />
      </App>,
    )
    expect(container.querySelector("[role='status']")).toBeNull()
    expect(container.querySelector("[role='alert']")).toBeNull()
    expect(container.querySelector("[aria-live]")).toBeNull()
  })

  test("does not announce on the initial load", () => {
    render(
      <App>
        <TitleSetter title="Home" />
      </App>,
    )
    expect(mockAnnounce).not.toHaveBeenCalled()
  })

  test("announces an async (post-navigation, same-route) title change politely, exactly once", async () => {
    // Initial load on "/".
    const { rerender } = render(
      <App>
        <TitleSetter title="Home" />
      </App>,
    )

    // Navigate to a route whose title is not known yet (loading).
    mockState.pathname = "/course/x"
    rerender(
      <App>
        <TitleSetter title={null} />
      </App>,
    )

    // Let the post-navigation settle window close (the setTimeout(0) in the manager fires).
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    mockAnnounce.mockClear()

    // Data resolves on the same route -> announce the late title.
    rerender(
      <App>
        <TitleSetter title="Course X" />
      </App>,
    )
    expect(document.title).toBe("Course X - Test Site")
    expect(mockAnnounce).toHaveBeenCalledTimes(1)
    expect(mockAnnounce).toHaveBeenCalledWith("Course X", "polite")
  })

  test("does not announce a navigation-time title change (Next's built-in announcer owns it)", async () => {
    const { rerender } = render(
      <App>
        <TitleSetter title="Home" />
      </App>,
    )
    // Close the initial-mount settle window FIRST, so the suppression asserted below is caused by
    // the navigation-detection branch and not by a still-open initial window.
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    mockAnnounce.mockClear()

    // Navigation: both the pathname and the title change in the same step.
    mockState.pathname = "/about"
    rerender(
      <App>
        <TitleSetter title="About" />
      </App>,
    )
    expect(document.title).toBe("About - Test Site")
    expect(mockAnnounce).not.toHaveBeenCalled()
  })

  test("does not re-announce when the title blips to null and back (e.g. a refetch)", async () => {
    const { rerender } = render(
      <App>
        <TitleSetter title="Home" />
      </App>,
    )
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    mockAnnounce.mockClear()

    // An async title change on the same route is announced once.
    rerender(
      <App>
        <TitleSetter title="Course X" />
      </App>,
    )
    expect(mockAnnounce).toHaveBeenCalledTimes(1)

    // The title transiently goes null (a refetch) ...
    rerender(
      <App>
        <TitleSetter title={null} />
      </App>,
    )
    // ... then resolves back to the same value. This must NOT count as a change and re-announce.
    rerender(
      <App>
        <TitleSetter title="Course X" />
      </App>,
    )
    expect(mockAnnounce).toHaveBeenCalledTimes(1)
  })
})
