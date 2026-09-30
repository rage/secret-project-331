"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { axe, toHaveNoViolations } from "jest-axe"

import type { ChapterPointsBreakdown } from "@/generated/course-material-api/types.generated"

import type { PointsBreakdownScope } from "../PointsBreakdownDialog"
import ProgressCard from "../ProgressCard"

expect.extend(toHaveNoViolations)

// Resolves the real English strings, so assertions read as the user would.
jest.mock("react-i18next", () => {
  const en: Record<string, string> = jest.requireActual(
    "@/shared-module/common/locales/en/main-frontend.json",
  )
  const t = (key: string, options: Record<string, string | number> = {}) => {
    const count = options.count
    const pluralKey =
      typeof count === "number" ? `${key}_${new Intl.PluralRules("en").select(count)}` : null
    const template = (pluralKey && en[pluralKey]) ?? en[key] ?? key
    return template.replaceAll(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options[name]))
  }
  return {
    useTranslation: () => ({
      t,
      i18n: { language: "en", changeLanguage: () => Promise.resolve() },
    }),
  }
})

const mockGetBreakdown = jest.fn<Promise<ChapterPointsBreakdown[]>, [unknown]>()
jest.mock("@/generated/course-material-api/sdk.generated", () => ({
  getCourseMaterialCourseModulePointsBreakdown: (options: unknown) => mockGetBreakdown(options),
}))

const scope: PointsBreakdownScope = {
  courseInstanceId: "instance-1",
  courseModuleId: "module-1",
  organizationSlug: "uh-cs",
  courseSlug: "basics",
}

const chapters: ChapterPointsBreakdown[] = [
  {
    chapter_id: "chapter-1",
    chapter_number: 1,
    name: "Basics",
    score_given: 10.5,
    score_maximum: 16,
    pages: [
      {
        page_id: "page-1",
        title: "Variables",
        url_path: "/chapter-1/variables",
        score_given: 6.5,
        score_maximum: 10,
        exercises: [
          {
            exercise_id: "types",
            name: "Types",
            status: "Done",
            score_given: 4,
            score_maximum: 4,
            attempts: 2,
            attempts_limit: 3,
          },
          {
            exercise_id: "casts",
            name: "Casts",
            status: "WaitingForPeerReviews",
            score_given: 2.5,
            score_maximum: 6,
            attempts: 1,
            attempts_limit: null,
          },
        ],
      },
      {
        page_id: "page-2",
        title: "Loops",
        url_path: "/chapter-1/loops",
        score_given: 4,
        score_maximum: 6,
        exercises: [
          {
            exercise_id: "while",
            name: "While",
            status: "Done",
            score_given: 4,
            score_maximum: 4,
            attempts: 3,
          },
          {
            exercise_id: "for",
            name: "For",
            status: "NotAnswered",
            score_given: 0,
            score_maximum: 2,
            attempts: 0,
          },
        ],
      },
    ],
  },
  {
    chapter_id: "chapter-2",
    chapter_number: 2,
    name: "Functions",
    score_given: 0,
    score_maximum: 5,
    pages: [
      {
        page_id: "page-3",
        title: "Arguments",
        url_path: "/chapter-2/arguments",
        score_given: 0,
        score_maximum: 5,
        exercises: [
          {
            exercise_id: "defaults",
            name: "Defaults",
            status: "WaitingForTeacherGrading",
            score_given: 0,
            score_maximum: 5,
            attempts: 1,
            attempts_limit: 1,
          },
        ],
      },
    ],
  },
]

const measure = { given: 10.5, max: 30, required: null }

const renderCard = (pointsBreakdown: PointsBreakdownScope | null = scope) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProgressCard
        variant="module"
        headingLevel={3}
        moduleName="Introduction"
        requiresExam={false}
        automaticCompletion
        pointsBreakdown={pointsBreakdown}
        points={{ ...measure, required: 15 }}
        exercises={{ given: 4, max: 5, required: null }}
      />
    </QueryClientProvider>,
  )

const SHOW_ALL = "Show all exercises in this course"

const openDialog = async () => {
  fireEvent.click(screen.getByRole("button", { name: SHOW_ALL }))
  const dialog = await screen.findByRole("dialog", { name: /^All exercises/ })
  await within(dialog).findByRole("heading", { level: 3, name: "Chapter 1: Basics" })
  return dialog
}

beforeEach(() => {
  mockGetBreakdown.mockReset()
  mockGetBreakdown.mockResolvedValue(chapters)
})

describe("points breakdown", () => {
  it("fetches nothing until the dialog opens, then fetches the card's module", async () => {
    renderCard()
    expect(mockGetBreakdown).not.toHaveBeenCalled()
    await openDialog()
    expect(mockGetBreakdown).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { course_instance_id: "instance-1", course_module_id: "module-1" },
      }),
    )
  })

  it("is left out without a scope", () => {
    renderCard(null)
    expect(screen.queryByRole("button", { name: SHOW_ALL })).toBeNull()
  })

  it("sits between the exercises chart and the completion requirements", () => {
    renderCard()
    const button = screen.getByRole("button", { name: SHOW_ALL })
    const exercises = screen.getByRole("heading", { name: "Exercises attempted" })
    const requirements = screen.getByRole("heading", { name: "Completion requirements" })
    expect(exercises.compareDocumentPosition(button)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(button.compareDocumentPosition(requirements)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(button).toHaveAttribute("aria-haspopup", "dialog")
  })

  it("nests pages under chapters and states each subtotal in full", async () => {
    renderCard()
    const dialog = await openDialog()
    const headings = within(dialog)
      .getAllByRole("heading")
      .map((heading) => `${heading.tagName} ${heading.textContent}`)
    expect(headings).toEqual([
      "H2 All exercisesIntroduction · 10.5 / 30 points · 4 of 5 exercises attempted",
      "H3 Chapter 1: Basics",
      "H4 Variables",
      "H4 Loops",
      "H3 Chapter 2: Functions",
      "H4 Arguments",
    ])
    expect(within(dialog).getByText("10.5 of 16 points")).toBeInTheDocument()
    expect(within(dialog).getByText("6.5 of 10 points")).toBeInTheDocument()
    // Chapter 2 and its only page; its only exercise is not graded yet.
    expect(within(dialog).getAllByText("0 of 5 points")).toHaveLength(2)
  })

  it("lists each page's exercises with status, attempts and points", async () => {
    renderCard()
    const dialog = await openDialog()
    const [variables] = within(dialog).getAllByRole("list")
    const rows = within(variables as HTMLElement).getAllByRole("listitem")
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent("Done")
    expect(rows[0]).toHaveTextContent("2 of 3 attempts")
    expect(rows[0]).toHaveTextContent("4 of 4 points")
    expect(rows[1]).toHaveTextContent("Waiting for peer reviews")
    expect(rows[1]).toHaveTextContent("1 attempt")
    expect(rows[1]).not.toHaveTextContent(/ of \d+ attempt/)
    expect(within(dialog).getByText("3 attempts")).toBeInTheDocument()
    expect(within(dialog).getByText("1 of 1 attempt")).toBeInTheDocument()
    expect(within(dialog).getByText("Waiting for teacher")).toBeInTheDocument()
  })

  it("shows a dash for points not graded yet, and no attempts before the first", async () => {
    renderCard()
    const dialog = await openDialog()
    const [, loops] = within(dialog).getAllByRole("list")
    const [, closed] = within(loops as HTMLElement).getAllByRole("listitem")
    expect(closed).toHaveTextContent("Closed")
    expect(closed).toHaveTextContent("0 of 2 points")
    expect(closed).not.toHaveTextContent("attempt")
    const defaults = within(dialog).getByRole("link", { name: "Defaults" }).closest("li")
    expect(defaults).toHaveTextContent("\u2013")
    expect(defaults).toHaveTextContent("Not graded yet, up to 5 points")
    const casts = within(dialog).getByRole("link", { name: "Casts" }).closest("li")
    expect(casts).toHaveTextContent("2.5 of 6 points")
  })

  it("links each exercise to its anchor on its page, and closes on the way", async () => {
    renderCard()
    const dialog = await openDialog()
    const link = within(dialog).getByRole("link", { name: "Casts" })
    expect(link).toHaveAttribute("href", "/org/uh-cs/courses/basics/chapter-1/variables#casts")
    // jsdom cannot navigate; only the dialog's reaction to the click is under test.
    link.addEventListener("click", (event) => event.preventDefault())
    fireEvent.click(link)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("says so when no exercise has opened", async () => {
    mockGetBreakdown.mockResolvedValue([])
    renderCard()
    fireEvent.click(screen.getByRole("button", { name: SHOW_ALL }))
    expect(await screen.findByText("No exercises have opened yet.")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "All exercises Introduction" })).toBeInTheDocument()
  })

  it("has no axe violations while open", async () => {
    const { baseElement } = renderCard()
    await openDialog()
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
