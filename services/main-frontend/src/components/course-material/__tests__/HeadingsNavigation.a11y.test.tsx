"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import HeadingsNavigation from "../HeadingsNavigation"

jest.mock("jotai", () => ({
  ...jest.requireActual("jotai"),
  useAtomValue: () => null,
}))
jest.mock("@/state/course-material/selectors", () => ({
  currentPageIdAtom: {},
  examDataAtom: {},
}))
jest.mock("@/hooks/course-material/useIsPageChapterFrontPage", () => ({
  __esModule: true,
  default: () => ({ isLoading: false, data: { is_chapter_front_page: false } }),
}))
jest.mock("@/shared-module/common/hooks/useShouldHideStuffForSystemTestScreenshots", () => ({
  __esModule: true,
  default: () => false,
}))

const headings: HTMLHeadingElement[] = []
jest.mock("@/hooks/course-material/useHeadingData", () => ({
  __esModule: true,
  default: () => ({
    headings: headings.map((element, i) => ({
      title: element.textContent,
      level: 2,
      headingsNavigationIndex: String(i),
      element,
    })),
  }),
}))

jest.mock("usehooks-ts", () => ({
  // Wide screen: the drawer starts expanded.
  useMediaQuery: (query: string) => query.includes("min-width"),
}))

describe("HeadingsNavigation (F-20)", () => {
  beforeEach(() => {
    headings.length = 0
    for (const text of ["First", "Second"]) {
      const h = document.createElement("h2")
      h.textContent = text
      document.body.append(h)
      headings.push(h)
    }
  })
  afterEach(() => {
    headings.forEach((h) => h.remove())
  })

  it("names the landmark, focuses the heading on click and marks the current item", () => {
    render(<HeadingsNavigation />)

    expect(screen.getByRole("navigation", { name: "in-this-page" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Second" }))

    expect(document.activeElement).toBe(headings[1])
    expect(screen.getByRole("button", { name: "Second" })).toHaveAttribute(
      "aria-current",
      "location",
    )
  })

  it("exposes the toggle state and makes a collapsed drawer inert", () => {
    render(<HeadingsNavigation />)

    const toggle = screen.getByRole("button", { name: "close-heading-menu" })
    expect(toggle).toHaveAttribute("aria-expanded", "true")

    fireEvent.click(toggle)

    const open = screen.getByRole("button", { name: "open-heading-menu" })
    expect(open).toHaveAttribute("aria-expanded", "false")
    const drawer = document.querySelector("[aria-hidden='true']") as HTMLElement
    expect(drawer).toHaveAttribute("inert")
    expect(drawer.querySelectorAll("button")).toHaveLength(2)
  })
})
