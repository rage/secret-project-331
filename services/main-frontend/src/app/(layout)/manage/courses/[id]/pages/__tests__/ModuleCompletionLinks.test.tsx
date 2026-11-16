"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import CourseModuleForm from "../CourseModuleForm"
import type { ModuleView } from "../CourseModules"
import { NEW_MODULE_COMPLETION_SETTINGS } from "../moduleCompletionSettings"

jest.mock("@/generated/api/sdk.generated", () => ({
  getCourseExercises: () => Promise.resolve([]),
  getCourseLinkableExams: () => Promise.resolve([]),
  setExamCourse: jest.fn(),
}))

// Renders the `anchor` component around fixed text, like Trans does with `<anchor>...</anchor>`.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({
    components,
  }: {
    components?: Record<string, React.ReactElement<{ children?: React.ReactNode }>>
  }) => (components?.anchor ? React.cloneElement(components.anchor, {}, "Students tab") : null),
}))

const module_: ModuleView = {
  id: "module-1",
  name: null,
  order_number: 0,
  firstChapter: 1,
  lastChapter: 1,
  isNew: false,
  ...NEW_MODULE_COMPLETION_SETTINGS,
  completion_method: "teacher_adds",
}

describe("ModuleCompletionFields links", () => {
  it("puts the link text inside the link", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CourseModuleForm
          mode="edit"
          module={module_}
          chapters={[1]}
          creditRegistrationConfig={undefined}
          linkedExams={[]}
          courseId="course-1"
          chapterNumberById={new Map()}
          links={{ studentsTab: "/students", examsPage: "/org/uh", certificatesPage: "/certs" }}
          canToggleCertificates
          onSubmitForm={jest.fn()}
        />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "edit" }))

    const link = screen.getAllByRole("link", { name: "Students tab" })[0]
    expect(link).toHaveAttribute("href", "/students")
  })
})
