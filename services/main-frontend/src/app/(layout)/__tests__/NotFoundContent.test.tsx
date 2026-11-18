"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import NotFoundContent from "../NotFoundContent"

const mockUsePageTitle = jest.fn()
jest.mock("@/shared-module/common/hooks/usePageTitle", () => ({
  usePageTitle: (...args: unknown[]) => mockUsePageTitle(...args),
}))

describe("NotFoundContent", () => {
  it("has a heading, a link home and sets the page title", () => {
    render(<NotFoundContent />)
    expect(screen.getByRole("heading", { level: 1, name: "not-found-title" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "home-page" })).toHaveAttribute("href", "/")
    expect(mockUsePageTitle).toHaveBeenCalledWith("not-found-title")
  })
})
