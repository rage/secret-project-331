"use client"

import { fireEvent, render, screen, within } from "@testing-library/react"
import React from "react"

import SearchButton from "../SearchButton"

import {
  searchPagesWithPhrase,
  searchPagesWithWords,
} from "@/generated/course-material-api/sdk.generated"
import type { PageSearchResult } from "@/generated/course-material-api/types.generated"

// The global react-i18next mock (tests/setup-jest.js) returns a NEW `t` function on every
// useTranslation() call. SearchButton's data-fetching effect depends on `t` and sets new
// array state on each run, which turns that unstable identity into an infinite render loop
// in jsdom. Override the mock with a stable `t` for this suite.
jest.mock("react-i18next", () => {
  const t = (key: string) => key
  return {
    useTranslation: () => ({ t, i18n: { changeLanguage: () => Promise.resolve() } }),
    Translation: ({ children }: { children: (t: (key: string) => string) => React.ReactNode }) =>
      children(t),
  }
})

jest.mock("next/link", () => ({
  __esModule: true,
  default: React.forwardRef<HTMLAnchorElement, React.ComponentPropsWithoutRef<"a">>(
    function MockLink({ children, href, ...rest }, ref) {
      return (
        // eslint-disable-next-line jsx-a11y/anchor-is-valid
        <a ref={ref} href={typeof href === "string" ? href : ""} {...rest}>
          {children}
        </a>
      )
    },
  ),
}))

jest.mock("@/shared-module/common/components/dialogs/Dialog", () => ({
  __esModule: true,
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
}))

jest.mock("@/generated/course-material-api/sdk.generated", () => ({
  searchPagesWithPhrase: jest.fn(),
  searchPagesWithWords: jest.fn(),
}))

const mockSearchPagesWithPhrase = searchPagesWithPhrase as jest.Mock
const mockSearchPagesWithWords = searchPagesWithWords as jest.Mock

const RESULT: PageSearchResult = {
  id: "page-1",
  url_path: "/course-slug/chapter-1/the-cell",
  title_headline: "Introduction to cells",
  content_headline: "Cells are the basic unit of life",
  chapter_name: "Chapter 1",
  rank: 1,
}

describe("SearchButton search results", () => {
  beforeEach(() => {
    mockSearchPagesWithPhrase.mockReset().mockResolvedValue([RESULT])
    mockSearchPagesWithWords.mockReset().mockResolvedValue([])
  })

  async function openDialogAndSearch() {
    render(<SearchButton courseId="course-id" organizationSlug="org-slug" />)
    fireEvent.click(screen.getByRole("button", { name: "button-label-search-for-pages" }))
    const input = screen.getByPlaceholderText("search-field-placeholder")
    fireEvent.change(input, { target: { value: "cell" } })
    // Wait out the 200ms debounce and the mocked fetch.
    return await screen.findByRole("link", { name: "Introduction to cells" })
  }

  it("names the result link by the heading text only", async () => {
    const link = await openDialogAndSearch()
    // The heading is the accessible name; the excerpt must not be part of the link text.
    expect(link.textContent).toBe("Introduction to cells")
    expect(link.getAttribute("href")).toBe("/org/org-slug/courses/course-slug/chapter-1/the-cell")
    // The excerpt is rendered in the card, outside the link.
    expect(screen.getByText("Cells are the basic unit of life")).toBeTruthy()
  })

  it("renders exactly one link per result card so the stretched link covers the whole card", async () => {
    const link = await openDialogAndSearch()
    const card = link.closest("h2")?.parentElement as HTMLElement
    expect(card).toBeTruthy()
    expect(within(card).getAllByRole("link")).toHaveLength(1)
    expect(screen.getAllByRole("link")).toHaveLength(1)
  })
})
