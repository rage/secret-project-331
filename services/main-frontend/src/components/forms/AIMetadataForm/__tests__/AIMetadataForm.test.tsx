"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import type {
  Course,
  CourseAudience,
  CoursePrerequisite,
  SisuDescriptionResponse,
} from "@/generated/api/types.generated"

import AIMetadataForm from "../index"

const mockGetCourse = jest.fn()
const mockGetSisuCourseLlmDescriptions = jest.fn()
const mockGetCoursePrerequisites = jest.fn()
const mockGetCourseAudiences = jest.fn()
const mockUpdateMetadata = jest.fn()

jest.mock("@/generated/api/sdk.generated", () => ({
  getCourse: (...args: unknown[]) => mockGetCourse(...args),
  getSisuCourseLlmDescriptions: (...args: unknown[]) => mockGetSisuCourseLlmDescriptions(...args),
  getCoursePrerequisites: (...args: unknown[]) => mockGetCoursePrerequisites(...args),
  getCourseAudiences: (...args: unknown[]) => mockGetCourseAudiences(...args),
  updateMetadata: (...args: unknown[]) => mockUpdateMetadata(...args),
}))

const COURSE: Course = {
  ai_policy: "NotSet",
  ask_marketing_consent: false,
  base_module_completion_requires_n_submodule_completions: 1,
  can_add_chatbot: false,
  chapter_locking_enabled: false,
  cheater_detection_enabled: false,
  course_language_group_id: "language-group-1",
  created_at: "2026-01-01T00:00:00.000Z",
  description: "Existing description",
  flagged_answers_skip_manual_review_and_allow_retry: false,
  id: "course-1",
  is_draft: false,
  is_joinable_by_code_only: false,
  is_test_mode: false,
  is_unlisted: false,
  language_code: "en",
  name: "Course 1",
  organization_id: "org-1",
  slug: "course-1",
  updated_at: "2026-01-01T00:00:00.000Z",
}

const SISU_DATA: SisuDescriptionResponse = {
  audience: [],
  course_description: "Suggested description",
  modules: [{ course_code: "ABC", description: "Module", prerequisites: [] }],
}

const PREREQUISITES: CoursePrerequisite[] = []
const AUDIENCES: CourseAudience[] = []

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSubmitForm = jest.fn()
  const onClose = jest.fn()
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AIMetadataForm courseId="course-1" open onSubmitForm={onSubmitForm} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { ...utils, onSubmitForm }
}

describe("AIMetadataForm", () => {
  beforeEach(() => {
    mockGetCourse.mockResolvedValue(COURSE)
    mockGetSisuCourseLlmDescriptions.mockResolvedValue(SISU_DATA)
    mockGetCoursePrerequisites.mockResolvedValue(PREREQUISITES)
    mockGetCourseAudiences.mockResolvedValue(AUDIENCES)
    mockUpdateMetadata.mockResolvedValue({
      course_audiences: [],
      course_description: null,
      course_prerequisites: [],
      course_updated_at: "2026-01-01T00:00:00.000Z",
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  /**
   * The confirm button lives in the Dialog's footer, outside the `<form>` it submits, and is
   * wired to it only via the HTML `form` attribute. That association needs an explicit
   * `type="submit"` on the button; clicking it without one is a no-op, so this has to click the
   * real button rather than call `fireEvent.submit(form)` directly.
   */
  it("submits the suggested metadata when the confirm button is clicked", async () => {
    const { onSubmitForm } = renderForm()

    const submitButton = await screen.findByRole("button", {
      name: "button-text-replace-metadata",
    })
    await waitFor(() => expect(submitButton).not.toBeDisabled())

    fireEvent.click(submitButton)

    await waitFor(() => expect(mockUpdateMetadata).toHaveBeenCalledTimes(1))
    const body = mockUpdateMetadata.mock.calls[0][0].body
    expect(body.course_description).toBe(SISU_DATA.course_description)
    await waitFor(() => expect(onSubmitForm).toHaveBeenCalledTimes(1))
  })
})
