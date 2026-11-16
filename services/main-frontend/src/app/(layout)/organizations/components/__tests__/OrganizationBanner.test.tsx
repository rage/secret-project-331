"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import OrganizationBanner from "../OrganizationBanner"

jest.mock("react-i18next", () => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- must live inside the mock factory
  const t = (key: string, opts?: Record<string, string>) =>
    opts ? `${key}:${Object.values(opts).join(",")}` : key
  return { useTranslation: () => ({ t, i18n: { language: "en" } }) }
})
jest.mock("@/shared-module/common/components/OnlyRenderIfPermissions", () => ({
  __esModule: true,
  default: () => null,
}))

describe("OrganizationBanner", () => {
  it("gives each Select link a unique name that starts with the visible text", () => {
    render(
      <>
        <OrganizationBanner
          organization={{ id: "1", name: "University of Helsinki", slug: "uh" }}
        />
        <OrganizationBanner organization={{ id: "2", name: "Aalto", slug: "aalto" }} />
      </>,
    )
    const links = screen.getAllByRole("link")
    const names = links.map((link) => link.getAttribute("aria-label"))
    expect(new Set(names).size).toBe(2)
    expect(names[0]).toBe("select-organization-named:University of Helsinki")
  })
})
