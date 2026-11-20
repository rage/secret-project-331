"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import type { CourseInstance } from "@/generated/course-material-api/types.generated"

import SelectCourseInstanceForm from "../SelectCourseInstanceForm"

jest.mock("@/generated/course-material-api/sdk.generated", () => ({
  updateMarketingConsent: jest.fn(),
}))
jest.mock("@/hooks/course-material/useCourse", () => ({
  __esModule: true,
  default: () => ({ data: { ask_marketing_consent: false }, isSuccess: true }),
}))
const mockQuestionsResult = {
  isLoading: false,
  error: null,
  data: {
    background_questions: [
      { id: "q-text", question_text: "Your university", question_type: "Text" },
      { id: "q-check", question_text: "I am a student", question_type: "Checkbox" },
    ],
    answers: [],
  },
}
jest.mock("@/hooks/course-material/useAdditionalQuestions", () => ({
  __esModule: true,
  default: () => mockQuestionsResult,
}))
jest.mock("../SelectMarketingConsentForm", () => ({ __esModule: true, default: () => null }))

const instances = [{ id: "instance-1", name: null, description: null }] as CourseInstance[]

describe("SelectCourseInstanceForm", () => {
  it("renders text questions as a labelled input and saves the typed answer", async () => {
    const mutate = jest.fn()
    render(
      <SelectCourseInstanceForm
        courseInstances={instances}
        submitMutation={{ mutate } as never}
        dialogLanguage="en"
        selectedLangCourseId="course-1"
      />,
    )
    const input = await screen.findByRole("textbox", { name: "Your university" })
    fireEvent.change(input, { target: { value: "Helsinki" } })
    fireEvent.click(screen.getByTestId("select-course-instance-continue-button"))
    await waitFor(() => expect(mutate).toHaveBeenCalled())
    expect(mutate.mock.calls[0][0].backgroundQuestionAnswers).toEqual([
      { course_background_question_id: "q-text", answer_value: "Helsinki" },
      { course_background_question_id: "q-check", answer_value: "f" },
    ])
  })

  it("uses an h3 for additional questions and keeps the footnote out of the radios", async () => {
    render(
      <SelectCourseInstanceForm
        courseInstances={instances}
        submitMutation={{ mutate: jest.fn() } as never}
        dialogLanguage="en"
        selectedLangCourseId="course-1"
      />,
    )
    expect(
      await screen.findByRole("heading", { level: 3, name: "title-additional-questions" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("radio")).not.toHaveAccessibleDescription(
      /select-course-instance-explanation/,
    )
  })
})
