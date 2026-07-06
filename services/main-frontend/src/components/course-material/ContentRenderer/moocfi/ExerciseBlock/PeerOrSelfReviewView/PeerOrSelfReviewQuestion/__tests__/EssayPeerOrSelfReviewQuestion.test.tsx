"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import EssayPeerOrSelfReviewQuestion from "../EssayPeerOrSelfReviewQuestion"

import type { PeerOrSelfReviewQuestion } from "@/generated/course-material-api/types.generated"

// react-i18next is globally mocked in tests/setup-jest.js (t(key) => key).

// TextAreaField uses IntersectionObserver for auto-resize; jsdom does not provide it.
beforeAll(() => {
  class MockIntersectionObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
})

const makeQuestion = (
  overrides: Partial<PeerOrSelfReviewQuestion> = {},
): PeerOrSelfReviewQuestion => ({
  answer_required: false,
  created_at: "2024-01-01T00:00:00Z",
  id: "q-1",
  order_number: 0,
  peer_or_self_review_config_id: "cfg-1",
  question: "What are your thoughts on the answer?",
  question_type: "Essay",
  updated_at: "2024-01-01T00:00:00Z",
  weight: 1,
  ...overrides,
})

describe("EssayPeerOrSelfReviewQuestion", () => {
  it("associates the question text as the label of the comment textarea", () => {
    render(
      <EssayPeerOrSelfReviewQuestion
        peerOrSelfReviewQuestion={makeQuestion()}
        setPeerOrSelfReviewQuestionAnswer={jest.fn()}
        peerOrSelfReviewQuestionAnswer={null}
      />,
    )

    // getByLabelText only matches when the label is programmatically associated with the field.
    const textarea = screen.getByLabelText("What are your thoughts on the answer?")
    expect(textarea.tagName).toBe("TEXTAREA")
  })

  it("marks a required question label with an asterisk", () => {
    render(
      <EssayPeerOrSelfReviewQuestion
        peerOrSelfReviewQuestion={makeQuestion({ answer_required: true })}
        setPeerOrSelfReviewQuestionAnswer={jest.fn()}
        peerOrSelfReviewQuestionAnswer={null}
      />,
    )

    const textarea = screen.getByLabelText("What are your thoughts on the answer? *")
    expect(textarea.tagName).toBe("TEXTAREA")
  })

  it("reflects the current answer value", () => {
    render(
      <EssayPeerOrSelfReviewQuestion
        peerOrSelfReviewQuestion={makeQuestion()}
        setPeerOrSelfReviewQuestionAnswer={jest.fn()}
        peerOrSelfReviewQuestionAnswer={{
          peer_or_self_review_question_id: "q-1",
          text_data: "A thoughtful comment",
          number_data: null,
        }}
      />,
    )

    const textarea = screen.getByLabelText(
      "What are your thoughts on the answer?",
    ) as HTMLTextAreaElement
    expect(textarea.value).toBe("A thoughtful comment")
  })
})
