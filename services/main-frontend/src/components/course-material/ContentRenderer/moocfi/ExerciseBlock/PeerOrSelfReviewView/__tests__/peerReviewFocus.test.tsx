"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import PeerOrSelfReviewView from ".."
import { focusPeerReviewHeading, requestPeerReviewHeadingFocus } from "../peerReviewFocus"
import WaitingForPeerReviews from "../WaitingForPeerReviews"

jest.mock("../PeerOrSelfReviewViewImpl", () => ({
  __esModule: true,
  default: () => <div>impl</div>,
}))
jest.mock("../..", () => ({ exerciseButtonStyles: "", makeExerciseButtonMutedStyles: "" }))
jest.mock("@/hooks/course-material/useCourseMaterialExerciseQuery", () => ({
  courseMaterialExerciseQueryKey: () => [],
}))
jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQueryClient: () => ({}),
}))

const EXERCISE_ID = "11111111-1111-1111-1111-111111111111"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("peer review heading focus (F-14, B-031)", () => {
  it("makes the peer review heading focusable and focuses it on request", () => {
    render(
      <PeerOrSelfReviewView
        exerciseNumber={0}
        exerciseId={EXERCISE_ID}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parentExerciseQuery={{} as any}
      />,
    )
    const heading = screen.getByRole("heading", { name: "title-peer-review" })
    expect(heading).toHaveAttribute("tabindex", "-1")
    focusPeerReviewHeading(EXERCISE_ID)
    expect(document.activeElement).toBe(heading)
  })

  it("focuses the waiting heading when it mounts after a final review was submitted", () => {
    requestPeerReviewHeadingFocus(EXERCISE_ID)
    render(<WaitingForPeerReviews exerciseId={EXERCISE_ID} />)
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "title-waiting-for-peer-reviews" }),
    )
  })

  it("does not move focus when nothing was requested", () => {
    render(<WaitingForPeerReviews exerciseId={EXERCISE_ID} />)
    expect(document.activeElement).toBe(document.body)
  })
})
