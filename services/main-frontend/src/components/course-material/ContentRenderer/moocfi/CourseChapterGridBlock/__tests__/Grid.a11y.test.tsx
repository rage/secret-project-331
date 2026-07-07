"use client"

import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"

import Grid from "../Grid"

import type { ChapterWithStatus } from "@/generated/course-material-api/types.generated"

// Focus the test on the list semantics of the grid, not the inner card chain.
jest.mock("../StyledCard", () => ({
  __esModule: true,
  default: ({ chapter }: { chapter: ChapterWithStatus }) => (
    <div data-testid={`card-${chapter.chapter_number}`}>{chapter.name}</div>
  ),
}))

const makeChapter = (n: number): ChapterWithStatus =>
  ({
    id: `chapter-${n}`,
    chapter_number: n,
    name: `Chapter ${n}`,
    course_id: "course",
    course_module_id: "module",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    exercise_deadline_override_count: 0,
    exercise_deadline_override_distinct_count: 0,
    status: "open",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

describe("Chapter grid list semantics (issue #72)", () => {
  it("wraps the chapters in a single list with one list item per chapter", () => {
    render(
      <Grid
        chapters={[makeChapter(2), makeChapter(1), makeChapter(3)]}
        courseSlug="course"
        now={new Date("2024-06-01T00:00:00Z")}
        organizationSlug="org"
        previewable={false}
        lockedChapterIds={new Set()}
      />,
    )

    expect(screen.getAllByRole("list")).toHaveLength(1)
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(3)
    items.forEach((item) => {
      expect(item.querySelector("[data-testid^='card-']")).not.toBeNull()
    })
  })
})
