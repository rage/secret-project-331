"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import { clearMeasurementCacheForTests } from "../../measureTextWidth"
import { ProgressTabContent } from "../ProgressTab"

// Stable t() to avoid an infinite render loop from the global i18next mock's unstable identity.
jest.mock("react-i18next", () => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- must live inside the mock factory
  const t = (key: string) => key
  return { useTranslation: () => ({ t, i18n: { changeLanguage: () => Promise.resolve() } }) }
})

jest.mock("../StudentPillCell", () => ({
  StudentPillCell: ({ userId }: { userId: string }) => <span>{userId}</span>,
}))

jest.mock("../../StudentsContext", () => ({
  useStudentsContext: () => ({ courseId: "course-1" }),
  useStudentsListParams: () => ({}),
  useStudentsSorting: () => ({ sorting: [], onSortingChange: () => undefined }),
}))

const CHAPTER_ID = "chapter-1"
const USER_ID = "user-1"

const identity = {
  data: { data: [{ user_id: USER_ID, first_name: "Ada", last_name: "Lovelace", email: "a@b.c" }] },
  isError: false,
  isPending: false,
  isLoading: false,
}

let chapterLockingEnabled = true

jest.mock("../../studentsQueries", () => ({
  PROGRESS_SORT_COLUMNS: [],
  formatStudentName: () => "Lovelace, Ada",
  useCourseStudentsIdentity: () => identity,
  useCourseStudentsProgressStructure: () => ({
    data: {
      chapters: [{ id: CHAPTER_ID, name: "1: Getting started", chapter_number: 1 }],
      chapter_availability: [
        { chapter_id: CHAPTER_ID, exercises_available: 4, points_available: 4 },
      ],
      chapter_locking_enabled: chapterLockingEnabled,
    },
    isError: false,
    isPending: false,
    isLoading: false,
  }),
  useCourseStudentsProgressDetail: () => ({
    data: {
      user_chapter_progress: [
        {
          user_id: USER_ID,
          chapter_id: CHAPTER_ID,
          points_obtained: 2,
          exercises_attempted: 3,
        },
      ],
      user_chapter_locking_statuses: [
        { user_id: USER_ID, chapter_id: CHAPTER_ID, status: "unlocked" },
      ],
    },
    isError: false,
    isPending: false,
    isLoading: false,
  }),
}))

describe("ProgressTabContent", () => {
  it("renders the per-chapter attempts count with its lock status", () => {
    chapterLockingEnabled = true
    render(<ProgressTabContent />)

    // Regression guard: the cell value used to be a React element placed in the row data, which
    // TanStack's default cell renderer stringified into "[object Object]".
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
    expect(screen.getByText("teacher-chapter-lock-status-unlocked")).toBeInTheDocument()
  })

  it("gives every leaf column a declared width and a resize handle", () => {
    chapterLockingEnabled = true
    const { container } = render(<ProgressTabContent />)

    // Fixed widths come from the colgroup; without it the columns re-size as the body scrolls.
    const columnWidths = container.querySelectorAll("colgroup col")
    const groupHeaderCount = container.querySelectorAll("thead th[colspan]").length
    expect(columnWidths.length).toBeGreaterThan(0)
    expect(groupHeaderCount).toBeGreaterThan(0)
    const expectedHandles = columnWidths.length + groupHeaderCount
    expect(screen.getAllByTestId("column-resize-handle")).toHaveLength(expectedHandles)
    expect(screen.getAllByRole("slider")).toHaveLength(expectedHandles)
  })

  it("puts a resize handle on the grouped headers in the top row too", () => {
    chapterLockingEnabled = true
    const { container } = render(<ProgressTabContent />)

    // Grouped headers have sub-columns, so a leaf-only rule left the whole top row unresizable.
    const topRowHeaders = container.querySelectorAll("thead tr:first-of-type th")
    expect(topRowHeaders.length).toBeGreaterThan(0)
    for (const header of topRowHeaders) {
      expect(header.querySelector("[data-testid='column-resize-handle']")).not.toBeNull()
    }
  })

  it("applies measured widths without re-rendering forever", () => {
    // jsdom has no canvas, so measurement normally bails out and never commits a width. Stubbing it
    // exercises the real path, where an unguarded commit would loop until React gives up.
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      font: "",
      measureText: (text: string) => ({ width: text.length * 7 }),
    })) as unknown as HTMLCanvasElement["getContext"]
    clearMeasurementCacheForTests()

    try {
      chapterLockingEnabled = true
      const { container } = render(<ProgressTabContent />)
      const widths = [...container.querySelectorAll("colgroup col")].map(
        (col) => (col as HTMLTableColElement).style.width,
      )
      expect(widths.length).toBeGreaterThan(0)
      expect(widths.every((width) => width !== "")).toBe(true)
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext
      clearMeasurementCacheForTests()
    }
  })

  it("renders a bare attempts count when chapter locking is disabled", () => {
    chapterLockingEnabled = false
    render(<ProgressTabContent />)

    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
    expect(screen.queryByText("teacher-chapter-lock-status-unlocked")).not.toBeInTheDocument()
  })
})
