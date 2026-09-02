"use client"

import { fireEvent, render, screen } from "@testing-library/react"
import { createInstance } from "i18next"
import type React from "react"
import { I18nextProvider, initReactI18next } from "react-i18next"

import usePaginationInfo from "../../hooks/usePaginationInfo"
import sharedModuleTranslations from "../../locales/en/shared-module.json"
import PaginationControls from "../PaginationControls"

const mockNavigation = {
  replace: jest.fn(),
  search: "",
}

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockNavigation.replace }),
  useSearchParams: () => new URLSearchParams(mockNavigation.search),
}))

const i18n = createInstance()

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    ns: ["shared-module"],
    defaultNS: "shared-module",
    resources: {
      en: {
        "shared-module": sharedModuleTranslations,
      },
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })
})

function renderControls(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

function makePaginationInfo(page: number) {
  return {
    page,
    setPage: jest.fn(),
    limit: 100,
    setLimit: jest.fn(),
  }
}

function PaginationControlsWithRealHook({ totalPages }: { totalPages: number }) {
  const paginationInfo = usePaginationInfo()
  return <PaginationControls paginationInfo={paginationInfo} totalPages={totalPages} />
}

describe("PaginationControls - pass-through", () => {
  test("passes page and totalPages down to the underlying Pagination", () => {
    const paginationInfo = makePaginationInfo(3)
    renderControls(<PaginationControls paginationInfo={paginationInfo} totalPages={5} />)

    expect(screen.getByRole("button", { name: "Page 3" })).toHaveAttribute("aria-current", "page")
  })

  test("a page button press calls paginationInfo.setPage with the target page", () => {
    const paginationInfo = makePaginationInfo(1)
    renderControls(<PaginationControls paginationInfo={paginationInfo} totalPages={5} />)

    fireEvent.click(screen.getByRole("button", { name: "Go to page 4" }))
    expect(paginationInfo.setPage).toHaveBeenCalledWith(4)
  })

  test("forwards label, isDisabled, className and data-testid", () => {
    const paginationInfo = makePaginationInfo(1)
    renderControls(
      <PaginationControls
        paginationInfo={paginationInfo}
        totalPages={5}
        label="Course list pages"
        isDisabled
        className="my-pager"
        data-testid="course-list-pager"
      />,
    )

    const nav = screen.getByRole("navigation", { name: "Course list pages" })
    expect(nav).toHaveAttribute("data-testid", "course-list-pager")
    expect(nav.className).toContain("my-pager")
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  })
})

describe("PaginationControls - edge cases the old Pagination handled", () => {
  test("out-of-range page clamps for rendering without correcting paginationInfo", () => {
    const paginationInfo = makePaginationInfo(50)
    renderControls(<PaginationControls paginationInfo={paginationInfo} totalPages={5} />)

    expect(screen.getByRole("button", { name: "Page 5" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
    expect(paginationInfo.setPage).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }))
    expect(paginationInfo.setPage).toHaveBeenCalledWith(4)
  })

  test("renders nothing for a single page", () => {
    const paginationInfo = makePaginationInfo(1)
    renderControls(<PaginationControls paginationInfo={paginationInfo} totalPages={1} />)

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  })

  test("renders nothing for zero results", () => {
    const paginationInfo = makePaginationInfo(1)
    renderControls(<PaginationControls paginationInfo={paginationInfo} totalPages={0} />)

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  })
})

describe("PaginationControls - wired to usePaginationInfo", () => {
  beforeEach(() => {
    mockNavigation.search = ""
    mockNavigation.replace.mockClear()
    window.history.pushState({}, "", "/manage/courses")
  })

  test("reads the initial page from the URL and preserves other params when it changes", () => {
    mockNavigation.search = "search=alice&page=2"
    renderControls(<PaginationControlsWithRealHook totalPages={5} />)

    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page")

    fireEvent.click(screen.getByRole("button", { name: "Next page" }))
    expect(mockNavigation.replace).toHaveBeenCalledWith("/manage/courses?search=alice&page=3")
  })

  test("clamps a zero or negative page param to 1, matching usePaginationInfo today", () => {
    mockNavigation.search = "page=0"
    renderControls(<PaginationControlsWithRealHook totalPages={5} />)

    expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
  })
})
