"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import React from "react"

import SelectCourseLanguage from "../SelectCourseLanguage"

jest.mock("@/state/course-material/selectors", () => {
  const { atom } = jest.requireActual("jotai")
  return {
    currentPageDataAtom: atom({ course_id: "course-en" }),
  }
})

jest.mock("@/hooks/course-material/useCourseLanguageVersionNavigationInfos", () => ({
  __esModule: true,
  default: () => ({
    data: [
      { course_id: "course-en", language_code: "en-US", course_slug: "c-en", page_path: "/" },
      { course_id: "course-fi", language_code: "fi-FI", course_slug: "c-fi", page_path: "/" },
    ],
    isSuccess: true,
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
  }),
}))

jest.mock("@/shared-module/components", () => ({
  QueryResult: ({ children }: { children: (data: unknown) => React.ReactNode }) => (
    <>{children([])}</>
  ),
}))

/** Collects all CSS injected into the document (emotion inserts rules via CSSOM). */
const getInjectedCss = (): string =>
  Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText)
      } catch {
        return []
      }
    })
    .join("\n")

const renderComponent = () =>
  render(
    <SelectCourseLanguage
      selectedLangCourseId="course-en"
      setSelectedLangCourseId={jest.fn()}
      setDialogLanguage={jest.fn()}
      dialogLanguage="en-US"
      currentPageId="page-1"
    />,
  )

describe("SelectCourseLanguage accessibility (issues #48, #62)", () => {
  it("marks each language option with the lang attribute of its language", () => {
    renderComponent()
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveAttribute("lang", "en-US")
    expect(options[1]).toHaveAttribute("lang", "fi-FI")
  })

  it("keeps the select fluid so the row can reflow at narrow viewports", () => {
    renderComponent()
    const css = getInjectedCss()
    expect(css).toContain("flex-wrap: wrap")
    expect(css).toContain("max-width: 100%")
  })
})
