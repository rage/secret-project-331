"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import Topbar from "../index"

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))
jest.mock("../Brand", () => ({ __esModule: true, default: () => <span>brand</span> }))
jest.mock("../LanguageMenu", () => ({ __esModule: true, default: () => <button>lang</button> }))
jest.mock("../SearchButton", () => ({ __esModule: true, default: () => <button>search</button> }))
jest.mock("../UserMenu", () => ({ __esModule: true, default: () => <button>user</button> }))
jest.mock("../QuickActionsMenu", () => ({ __esModule: true, default: () => null }))
jest.mock("../MobileMenu/MobileMenuOverlay", () => ({ MobileMenuOverlay: () => null }))
jest.mock("../MobileMenu/MobileMenuButton", () => ({ MobileMenuButton: () => null }))

describe("Topbar", () => {
  it("starts with a skip link to the main content", () => {
    render(<Topbar courseId="c" organizationSlug="o" />)
    const links = screen.getAllByRole("link", { hidden: true })
    expect(links[0]).toHaveAttribute("href", "#maincontent")
    expect(links[0]).toHaveTextContent("skip-to-content")
  })

  it("exposes no separators to assistive technology", () => {
    render(<Topbar courseId="c" organizationSlug="o" />)
    expect(screen.queryAllByRole("separator", { hidden: false })).toHaveLength(0)
  })

  it("renders the primary navigation only when it has children", () => {
    const { unmount } = render(<Topbar courseId="c" organizationSlug="o" />)
    expect(screen.queryByRole("navigation", { hidden: true })).toBeNull()
    unmount()
    render(
      <Topbar courseId="c" organizationSlug="o">
        <span>x</span>
      </Topbar>,
    )
    expect(screen.getByRole("navigation", { hidden: true })).toBeInTheDocument()
  })
})
