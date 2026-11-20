import { render, screen } from "@testing-library/react"
import { vi } from "vitest"

import EditorCard from "../EditorCard"

vi.mock("../../../../../../hooks/useQuizzesExerciseServiceOutputState", () => ({
  default: () => ({ selected: { items: [] }, updateState: vi.fn() }),
}))

describe("EditorCard", () => {
  it("names the move and delete icon buttons", () => {
    render(
      <EditorCard title="Essay" quizItemId="q1">
        <div />
      </EditorCard>,
    )
    expect(screen.getByRole("button", { name: "move-item-up" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "move-item-down" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "delete-item-named" })).toBeInTheDocument()
  })
})
