"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import type { Exercise } from "@/generated/course-material-api/types.generated"

import ExerciseStatusMessage from "../ExerciseStatusMessage"

// react-i18next is mocked in tests/setup-jest.js, so t() returns the translation key.
const EXERCISE: Exercise = {
  chapter_id: null,
  copied_from: null,
  course_id: "1d5d6f9e-1e28-4b0c-9d9a-6b3c31b6f0a7",
  created_at: "2024-01-01T00:00:00Z",
  deadline: null,
  deleted_at: null,
  exam_id: null,
  exercise_language_group_id: null,
  id: "0d2c0b0a-58b4-4a92-9d5c-3a58b8f9b1a2",
  limit_number_of_tries: false,
  max_tries_per_slide: null,
  name: "Best exercise",
  needs_peer_review: false,
  needs_self_review: false,
  order_number: 1,
  page_id: "6a0f2b3c-8a4d-4a4a-9a4a-2b2c3d4e5f60",
  score_maximum: 1,
  teacher_reviews_answer_after_locking: false,
  updated_at: "2024-01-01T00:00:00Z",
  use_course_default_peer_or_self_review_config: false,
}

const renderMessage = (props: Partial<React.ComponentProps<typeof ExerciseStatusMessage>> = {}) =>
  render(
    <ExerciseStatusMessage
      gradingProgress="FullyGraded"
      reviewingStage="NotStarted"
      peerOrSelfReviewConfig={null}
      exercise={EXERCISE}
      shouldSeeResetMessage={null}
      teacherGradingDecision={null}
      {...props}
    />,
  )

describe("ExerciseStatusMessage teacher feedback", () => {
  it("explains the chosen reason before the teacher's own message", () => {
    const { container } = renderMessage({
      teacherGradingDecision: {
        teacher_decision: "UnauthorizedAiUse",
        justification: "This exercise does not allow AI.",
      },
    })

    const paragraphs = Array.from(container.querySelectorAll("p")).map((p) => p.textContent)
    expect(paragraphs).toEqual([
      "label-feedback",
      "help-text-grading-decision-unauthorized-ai-use",
      "This exercise does not allow AI.",
    ])
  })

  it.each([
    ["BadAnswer", "help-text-grading-decision-bad-answer"],
    ["SuspectedPlagiarism", "help-text-grading-decision-plagiarism"],
    ["UnauthorizedAiUse", "help-text-grading-decision-unauthorized-ai-use"],
    ["Other", "help-text-grading-decision-other"],
  ] as const)("explains %s even without a written message", (decision, expectedKey) => {
    renderMessage({ teacherGradingDecision: { teacher_decision: decision, justification: null } })

    expect(screen.getByText(expectedKey)).toBeInTheDocument()
  })

  it("shows the teacher's message for a decision that only changed the points", () => {
    renderMessage({
      teacherGradingDecision: {
        teacher_decision: "CustomPoints",
        justification: "Half of the answer was missing.",
      },
    })

    expect(screen.getByText("Half of the answer was missing.")).toBeInTheDocument()
    expect(screen.queryByText(/^help-text-grading-decision-/)).not.toBeInTheDocument()
  })

  it("keeps the redo instruction alongside the decision", () => {
    renderMessage({
      shouldSeeResetMessage: "reset-by-staff",
      teacherGradingDecision: {
        teacher_decision: "BadAnswer",
        justification: "Please answer in your own words.",
      },
    })

    expect(
      screen.getByText("help-text-exercise-involves-reject-and-reset-by-staff"),
    ).toBeInTheDocument()
    expect(screen.getByText("help-text-grading-decision-bad-answer")).toBeInTheDocument()
  })

  it("renders nothing when there is no decision, reset or status message", () => {
    const { container } = renderMessage()

    expect(container).toBeEmptyDOMElement()
  })

  it("ignores a blank justification", () => {
    const { container } = renderMessage({
      teacherGradingDecision: { teacher_decision: "CustomPoints", justification: "   " },
    })

    expect(container).toBeEmptyDOMElement()
  })
})
