"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import useExamSubmissionsInfo from "@/hooks/useExamSubmissionsInfo"

import GradeExamAnswerForm from "../GradeExamAnswerForm"

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock("@/hooks/useExamSubmissionsInfo")
jest.mock("@/shared-module/common/hooks/usePaginationInfo", () => ({
  __esModule: true,
  default: () => ({ page: 1, limit: 10 }),
}))
jest.mock("@/shared-module/common/hooks/useToastMutationOptions", () => ({
  __esModule: true,
  default: () => ({ mutateAsync: jest.fn() }),
}))
jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  addTeacherGradingForExamSubmissionMutation: () => ({}),
  getExamUserExerciseStateInfoOptions: () => ({ queryKey: ["grading-info"] }),
  getExerciseSlideSubmissionInfoOptions: () => ({ queryKey: ["submission-info"] }),
}))
jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) =>
    queryKey[0] === "submission-info"
      ? {
          data: {
            exercise: { id: "exercise-1", exam_id: "exam-1", score_maximum: 10 },
            exercise_slide_submission: { user_id: "user-1" },
          },
        }
      : { data: { id: "state-1" }, refetch: jest.fn() },
}))

const mockedUseExamSubmissionsInfo = jest.mocked(useExamSubmissionsInfo)

function submissionsResult(submissionIds: string[]) {
  return {
    isSuccess: true,
    data: {
      data: submissionIds.map((id) => ({
        exercise_slide_submission: { id },
        teacher_grading_decision:
          id === "submission-1" ? { justification: "Stored feedback", score_given: 7 } : null,
      })),
    },
  } as unknown as ReturnType<typeof useExamSubmissionsInfo>
}

const loadingResult = { isSuccess: false, data: undefined } as ReturnType<
  typeof useExamSubmissionsInfo
>

const feedbackField = () => screen.getByRole("textbox", { name: /label-feedback/ })
const scoreField = () => screen.getByRole("spinbutton")

describe("GradeExamAnswerForm", () => {
  it("shows the stored grading once the submissions load", () => {
    mockedUseExamSubmissionsInfo.mockReturnValue(submissionsResult(["submission-1"]))
    render(<GradeExamAnswerForm submissionId="submission-1" />)

    expect(feedbackField()).toHaveValue("Stored feedback")
    expect(scoreField()).toHaveValue(7)
  })

  it("keeps typed feedback when the submissions arrive late", () => {
    mockedUseExamSubmissionsInfo.mockReturnValue(loadingResult)
    const { rerender } = render(<GradeExamAnswerForm submissionId="submission-1" />)

    fireEvent.change(feedbackField(), { target: { value: "Typed feedback" } })

    mockedUseExamSubmissionsInfo.mockReturnValue(submissionsResult(["submission-1"]))
    rerender(<GradeExamAnswerForm submissionId="submission-1" />)

    expect(feedbackField()).toHaveValue("Typed feedback")
    expect(scoreField()).toHaveValue(7)
  })

  it("clears the fields when navigating to another submission", () => {
    mockedUseExamSubmissionsInfo.mockReturnValue(
      submissionsResult(["submission-1", "submission-2"]),
    )
    const { rerender } = render(<GradeExamAnswerForm submissionId="submission-1" />)
    expect(feedbackField()).toHaveValue("Stored feedback")

    rerender(<GradeExamAnswerForm submissionId="submission-2" />)

    expect(feedbackField()).toHaveValue("")
    expect(scoreField()).toHaveValue(null)
  })
})
