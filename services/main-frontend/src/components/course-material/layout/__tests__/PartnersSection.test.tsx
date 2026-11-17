"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import PartnersSectionBlock from "../PartnersSection"

const mockContent = [
  {
    name: "core/image",
    clientId: "a",
    attributes: {
      url: "https://cdn.example.com/a.png",
      alt: "Saga Reading Society",
      href: "reading.example.org",
      linkDestination: "custom",
    },
  },
  {
    name: "core/image",
    clientId: "b",
    attributes: {
      url: "https://cdn.example.com/b.svg",
      alt: "Nordic Archives",
      href: "https://archives.example.org",
      linkDestination: "custom",
    },
  },
  {
    name: "core/image",
    clientId: "c",
    attributes: {
      url: "https://cdn.example.com/c.svg",
      alt: "",
      href: "https://noalt.example.org/path",
      linkDestination: "custom",
    },
  },
]

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  skipToken: Symbol("skip"),
  useQuery: () => ({ isSuccess: true, data: { content: mockContent } }),
}))

jest.mock("@/generated/course-material-api/sdk.generated", () => ({
  getCourseMaterialPartnersBlock: jest.fn(),
}))

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: () =>
      Promise.resolve(
        '<svg viewBox="0 0 10 10"><title>Inner title</title><text>Inner text</text></svg>',
      ),
  }) as never
})

describe("PartnersSection logos", () => {
  it("names each logo link from the CMS alt once and announces the new tab", async () => {
    render(<PartnersSectionBlock courseId="course" />)

    const png = screen.getByRole("link", { name: /^Saga Reading Society/ })
    expect(png).toHaveTextContent("screen-reader-opens-in-new-tab")
    expect(png).toHaveAttribute("target", "_blank")

    const svg = await screen.findByRole("link", { name: /^Nordic Archives/ })
    expect(svg).toHaveTextContent("screen-reader-opens-in-new-tab")
    // The SVG's own inner text is not part of the name.
    expect(svg).not.toHaveAccessibleName(expect.stringContaining("Inner"))
  })

  it("falls back to the link host when a logo has no alt", async () => {
    render(<PartnersSectionBlock courseId="course" />)
    expect(await screen.findByRole("link", { name: /^noalt\.example\.org/ })).toBeInTheDocument()
  })
})
