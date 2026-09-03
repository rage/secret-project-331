"use client"

import { screen } from "@testing-library/react"
import { I18nProvider } from "react-aria"

import { Breadcrumbs, type BreadcrumbItem } from "../src/components/Breadcrumbs"
import { renderUi } from "./testUtils"

jest.mock("next/link")

describe("Breadcrumbs", () => {
  test("renders a nav landmark named by the default translation", () => {
    renderUi(<Breadcrumbs items={[{ label: "Courses", href: "/courses" }, { label: "Course" }]} />)

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument()
  })

  test("accepts a custom landmark label", () => {
    renderUi(<Breadcrumbs items={[{ label: "Course" }]} label="Course trail" />)

    expect(screen.getByRole("navigation", { name: "Course trail" })).toBeInTheDocument()
  })

  test("marks the last ready item as the current page", () => {
    renderUi(
      <Breadcrumbs
        items={[{ label: "Courses", href: "/courses" }, { label: "Introduction to X" }]}
      />,
    )

    const current = screen.getByText("Introduction to X")
    expect(current.tagName).toBe("SPAN")
    expect(current).toHaveAttribute("aria-current", "page")

    const ancestor = screen.getByRole("link", { name: "Courses" })
    expect(ancestor).not.toHaveAttribute("aria-current")
  })

  test("never renders the current crumb as a real anchor, even when it carries an href", () => {
    renderUi(<Breadcrumbs items={[{ label: "Grading", href: "/grading" }]} />)

    const current = screen.getByText("Grading")
    expect(current.tagName).toBe("SPAN")
    expect(current).not.toHaveAttribute("href")
    expect(current.closest("a")).toBeNull()
    expect(current).toHaveAttribute("aria-current", "page")
  })

  test("renders a non-navigable crumb as plain text, not a disabled link", () => {
    renderUi(<Breadcrumbs items={[{ label: "Workspace" }, { label: "Course" }]} />)

    const workspace = screen.getByText("Workspace")
    expect(workspace.tagName).toBe("SPAN")
    expect(workspace).not.toHaveAttribute("role")
    expect(workspace).not.toHaveAttribute("aria-current")
    expect(screen.queryByRole("link", { name: "Workspace" })).not.toBeInTheDocument()
  })

  test("announces pending crumbs once via aria-busy on the nav, not per crumb", () => {
    const items: BreadcrumbItem[] = [
      { status: "pending", key: "a" },
      { status: "pending", key: "b" },
      { label: "Course" },
    ]
    renderUi(<Breadcrumbs items={items} />)

    expect(screen.getByRole("navigation")).toHaveAttribute("aria-busy", "true")
    expect(document.querySelectorAll("[aria-busy]")).toHaveLength(1)
    expect(screen.queryAllByRole("status")).toHaveLength(0)
    expect(document.querySelectorAll('[data-pending="true"]')).toHaveLength(2)
    expect(screen.getByText("Loading")).toBeInTheDocument()
  })

  test("carries no aria-busy once every crumb has resolved", () => {
    renderUi(<Breadcrumbs items={[{ label: "Course" }]} />)

    expect(screen.getByRole("navigation")).not.toHaveAttribute("aria-busy")
  })

  test.each([
    ["span", "SPAN", "link"],
    ["h1", "H1", "heading"],
    ["h2", "H2", "heading"],
    ["h3", "H3", "heading"],
  ] as const)("currentAs=%s renders a %s with the matching role", (currentAs, tagName, role) => {
    renderUi(<Breadcrumbs items={[{ label: "Grading" }]} currentAs={currentAs} />)

    const current = screen.getByRole(role, { name: "Grading" })
    expect(current.tagName).toBe(tagName)
    expect(current).toHaveAttribute("aria-current", "page")
  })

  test("keeps the full label as the accessible name even though it is truncated visually", () => {
    const longLabel = "A".repeat(80)
    renderUi(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: longLabel, href: "/x" },
          { label: "Current" },
        ]}
      />,
    )

    expect(screen.getByRole("link", { name: longLabel })).toHaveAttribute("href", "/x")
  })

  test("chooses the separator glyph from text direction instead of a hardcoded arrow", () => {
    const items: BreadcrumbItem[] = [{ label: "Courses", href: "/courses" }, { label: "Course" }]

    const { unmount } = renderUi(<Breadcrumbs items={items} />)
    expect(screen.getByText("›")).toBeInTheDocument()
    unmount()

    renderUi(
      <I18nProvider locale="ar">
        <Breadcrumbs items={items} />
      </I18nProvider>,
    )
    expect(screen.getByText("‹")).toBeInTheDocument()
  })

  test("spaces the separator with layout gap, not a hardcoded side margin", () => {
    renderUi(<Breadcrumbs items={[{ label: "Courses", href: "/courses" }, { label: "Course" }]} />)

    const separatorStyle = getComputedStyle(screen.getByText("›"))
    expect(separatorStyle.marginLeft).toBe("")
    expect(separatorStyle.marginRight).toBe("")

    const listStyle = getComputedStyle(screen.getByRole("list"))
    expect(listStyle.gap).not.toBe("")
  })

  test("renders an external crumb as a plain anchor rather than the package Link", () => {
    renderUi(
      <Breadcrumbs
        items={[{ label: "Main site", href: "/other-app", isExternal: true }, { label: "Course" }]}
      />,
    )

    const link = screen.getByRole("link", { name: "Main site" })
    expect(link.tagName).toBe("A")
    expect(link).toHaveAttribute("href", "/other-app")
  })

  test("puts the caller's className on the nav", () => {
    renderUi(<Breadcrumbs items={[{ label: "Course" }]} className="breadcrumbs-root" />)

    expect(screen.getByRole("navigation")).toHaveClass("breadcrumbs-root")
  })

  test("puts data-testid on the nav", () => {
    renderUi(<Breadcrumbs items={[{ label: "Course" }]} data-testid="course-breadcrumbs" />)

    expect(screen.getByTestId("course-breadcrumbs")).toBe(screen.getByRole("navigation"))
  })
})
