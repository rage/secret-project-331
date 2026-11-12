"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import type { LinkedExam } from "@/generated/api/types.generated"

import CourseModuleForm from "../CourseModuleForm"
import type { ModuleView } from "../CourseModules"
import { NEW_MODULE_COMPLETION_SETTINGS } from "../moduleCompletionSettings"

jest.mock("@/generated/api/sdk.generated", () => ({
  getCourseExercises: () => Promise.resolve([]),
}))

const LINKS = {
  studentsTab: "/students",
  examsPage: "/org/uh",
  certificatesPage: "/certificates",
}

const EXAM_WITH_PASS_MARK: LinkedExam = {
  id: "exam-1",
  name: "Final exam",
  starts_at: null,
  ends_at: null,
  pass_mark: 30,
}

const moduleWith = (overrides: Partial<ModuleView>): ModuleView => ({
  id: "module-1",
  name: null,
  order_number: 0,
  firstChapter: 1,
  lastChapter: 1,
  isNew: false,
  ...NEW_MODULE_COMPLETION_SETTINGS,
  uh_course_code: "TKT-12345",
  ects_credits: 5,
  completion_registration_link_override: "https://example.org/register",
  ...overrides,
})

function renderForm(module: ModuleView, linkedExams: LinkedExam[] = []) {
  const onSubmitForm = jest.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CourseModuleForm
        mode="edit"
        module={module}
        chapters={[1]}
        creditRegistrationConfig={undefined}
        linkedExams={linkedExams}
        courseId="course-1"
        chapterNumberById={new Map()}
        links={LINKS}
        canToggleCertificates
        onSubmitForm={onSubmitForm}
      />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole("button", { name: "edit" }))
  return { onSubmitForm }
}

const passMethod = (name: string) => screen.getByRole("radio", { name: new RegExp(`^${name}`) })

describe("CourseModuleForm", () => {
  it("switches to teacher-added completions for an exam outside the platform, and back", async () => {
    renderForm(moduleWith({ completion_method: "by_requirements", number_of_points_treshold: 10 }))
    expect(passMethod("pass-method-by-requirements")).toBeChecked()

    fireEvent.click(screen.getByRole("radio", { name: "yes" }))
    fireEvent.click(screen.getByRole("radio", { name: /^exam-location-examinarium/ }))

    await waitFor(() => expect(passMethod("pass-method-teacher-adds")).toBeChecked())
    expect(screen.getByText("pass-method-switched-outside-exam")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("radio", { name: /^no/ }))
    await waitFor(() => expect(passMethod("pass-method-by-requirements")).toBeChecked())
  })

  it("passes students by an exam with a pass mark and saves it as by_exam", async () => {
    const { onSubmitForm } = renderForm(moduleWith({ completion_method: "teacher_adds" }), [
      EXAM_WITH_PASS_MARK,
    ])

    fireEvent.click(screen.getByRole("radio", { name: "yes" }))
    fireEvent.click(screen.getByRole("radio", { name: /^exam-location-platform/ }))

    await waitFor(() => expect(passMethod("pass-method-by-exam")).toBeChecked())
    expect(screen.getByText("pass-method-switched-by-exam")).toBeInTheDocument()

    fireEvent.submit(document.querySelector("form") as HTMLFormElement)
    await waitFor(() =>
      expect(onSubmitForm).toHaveBeenCalledWith(
        "module-1",
        expect.objectContaining({
          completion_method: "by_exam",
          exam_requirement: "platform",
          number_of_points_treshold: null,
          credit_registration_route: "platform",
        }),
      ),
    )
  })
})
