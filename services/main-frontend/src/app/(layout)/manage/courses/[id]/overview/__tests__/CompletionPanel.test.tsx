"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"

import type {
  Course,
  CourseCompletionOverview,
  CourseModuleCompletionOverview,
} from "@/generated/api/types.generated"

import CompletionPanel from "../CompletionPanel"

const mockOverview = jest.fn<Promise<CourseCompletionOverview>, []>()

jest.mock("@/generated/api/sdk.generated", () => ({
  getCourseCompletionOverview: () => mockOverview(),
}))

jest.mock("@/shared-module/common/hooks/useAuthorizeMultiple", () => ({
  __esModule: true,
  default: () => ({ data: [true] }),
}))

const course = { id: "course-1", is_draft: false } as Course

const moduleWith = (
  overrides: Partial<CourseModuleCompletionOverview>,
): CourseModuleCompletionOverview => ({
  course_module_id: "module-1",
  name: null,
  order_number: 0,
  completion_method: "by_requirements",
  points_threshold: 10,
  exercises_attempted_threshold: null,
  exam_requirement: "none",
  credit_registration_route: "platform",
  uh_course_code: "TKT-12345",
  ects_credits: 5,
  certification_enabled: true,
  has_registration_link: true,
  has_completions: true,
  not_yet_registered_count: 0,
  course_code_allowed: true,
  credit_registration_paused_at: null,
  credit_registration_pause_reason: null,
  ...overrides,
})

const NO_EXAMS = { count: 0, pass_marks: "no_exams" } as const

function renderPanel(overview: CourseCompletionOverview) {
  mockOverview.mockResolvedValue(overview)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CompletionPanel course={course} />
    </QueryClientProvider>,
  )
}

describe("CompletionPanel", () => {
  it("says all set when nothing needs attention", async () => {
    renderPanel({ modules: [moduleWith({})], exams: NO_EXAMS })
    expect(await screen.findByText("completion-all-set")).toBeInTheDocument()
    expect(screen.queryByText("needs-action-prefix")).not.toBeInTheDocument()
  })

  it("counts each problem once and keeps reminders apart", async () => {
    renderPanel({
      modules: [
        moduleWith({ course_module_id: "a", completion_method: "not_decided" }),
        moduleWith({
          course_module_id: "c",
          name: "Project",
          completion_method: "teacher_adds",
          exam_requirement: "examinarium",
          has_completions: false,
        }),
        moduleWith({
          course_module_id: "b",
          name: "Final exam",
          completion_method: "teacher_adds",
          exam_requirement: "examinarium",
          credit_registration_route: "external",
          has_completions: false,
          course_code_allowed: false,
        }),
      ],
      exams: NO_EXAMS,
    })
    expect(await screen.findByText("completion-things-need-action")).toBeInTheDocument()
    expect(screen.getByText("completion-to-check")).toBeInTheDocument()
    expect(screen.getByText("problem-not-decided")).toBeInTheDocument()
    expect(screen.getByText("problem-registered-from-examinarium")).toBeInTheDocument()
    expect(screen.getByText("check-examinarium-access")).toBeInTheDocument()
    // An external route registers nothing here, so its course code check is moot.
    expect(screen.queryByText("problem-course-code-not-accepted")).not.toBeInTheDocument()
  })
})
