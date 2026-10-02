import { fireEvent, render, screen } from "@testing-library/react"
import { vi } from "vitest"

import type { UserItemAnswerMatrix } from "../../../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItemMatrix } from "../../../../../../../types/quizTypes/publicSpec"
import Matrix from "../Matrix"

// Override the global identity i18n mock so interpolation values (row/column) are visible.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options
        ? `${key} ${Object.entries(options)
            .map(([k, v]) => `${k}=${String(v)}`)
            .join(" ")}`
        : key,
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
}))

/** All CSS rules in the document; emotion inserts rules with insertRule, so style tag textContent is empty. */
const allCssText = () =>
  Array.from(document.styleSheets)
    .map((sheet) =>
      Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n"),
    )
    .join("\n")

const baseItem: PublicSpecQuizItemMatrix = {
  type: "matrix",
  id: "matrix-1",
  order: 0,
}

const renderMatrix = (answer: UserItemAnswerMatrix | null = null) => {
  const setQuizItemAnswerState = vi.fn()
  const utils = render(
    <Matrix
      quizDirection="column"
      quizItem={baseItem}
      quizItemAnswerState={answer}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user_information={{} as any}
      setQuizItemAnswerState={setQuizItemAnswerState}
    />,
  )
  return { ...utils, setQuizItemAnswerState }
}

const gappedAnswer: UserItemAnswerMatrix = {
  type: "matrix",
  valid: false,
  quizItemId: "matrix-1",
  matrix: [
    ["1", ""],
    ["", "4"],
  ],
}

describe("Matrix accessibility", () => {
  it("labels cells with 1-based row and column numbers (WCAG 1.3.1)", () => {
    renderMatrix()
    expect(screen.getByLabelText("matrix-cell-aria-label row=1 column=1")).toBeInTheDocument()
    expect(screen.getByLabelText("matrix-cell-aria-label row=6 column=6")).toBeInTheDocument()
    expect(screen.queryByLabelText(/row=0|column=0/)).not.toBeInTheDocument()
  })

  it("renders the full 6x6 grid of inputs", () => {
    renderMatrix()
    expect(screen.getAllByRole("textbox")).toHaveLength(36)
  })

  it("does not remove the focus outline and defines a focus-visible indicator (WCAG 2.4.7)", () => {
    renderMatrix()
    const styleText = allCssText()
    expect(styleText).not.toMatch(/outline:\s*none/)
    expect(styleText).toMatch(/:focus-visible[^}]*outline/)
  })

  it("uses cell separator borders with >= 3:1 contrast instead of the failing light gray", () => {
    renderMatrix()
    const styleText = allCssText()
    // jsdom's CSSOM serializes hex colors to rgb(), so accept either form of #8b8f96.
    expect(styleText).toMatch(/#8b8f96|rgb\(139,\s*143,\s*150\)/i)
    expect(styleText).not.toContain("#e1e1e1")
  })

  it("announces the matrix size and explains why a gapped answer cannot be submitted", () => {
    renderMatrix(gappedAnswer)
    const statuses = screen.getAllByRole("status")
    expect(statuses[0]).toHaveTextContent("matrix-size-status rows=2 columns=2")
    expect(statuses[1]).toHaveTextContent("matrix-fill-empty-cells")
  })

  it("does not flag gaps while the student is still typing in the grid", () => {
    renderMatrix(gappedAnswer)
    const gapCell = screen.getByLabelText("matrix-cell-aria-label row=1 column=2")
    fireEvent.focus(gapCell)
    expect(gapCell).not.toHaveAttribute("aria-invalid")
    expect(screen.queryByText("matrix-fill-empty-cells")).not.toBeInTheDocument()
    fireEvent.blur(gapCell)
    expect(gapCell).toHaveAttribute("aria-invalid", "true")
  })

  it("marks only the blank cells inside the frame as invalid", () => {
    renderMatrix(gappedAnswer)
    expect(screen.getByLabelText("matrix-cell-aria-label row=1 column=2")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    expect(screen.getByLabelText("matrix-cell-aria-label row=1 column=1")).not.toHaveAttribute(
      "aria-invalid",
    )
    expect(screen.getByLabelText("matrix-cell-aria-label row=3 column=3")).not.toHaveAttribute(
      "aria-invalid",
    )
  })

  it("stores the typed value for the edited cell", () => {
    const { setQuizItemAnswerState } = renderMatrix()
    const firstCell = screen.getByLabelText("matrix-cell-aria-label row=1 column=1")
    fireEvent.change(firstCell, { target: { value: "7" } })
    expect(setQuizItemAnswerState).toHaveBeenCalledWith(
      expect.objectContaining({
        matrix: expect.arrayContaining([expect.arrayContaining(["7"])]),
      }),
    )
  })

  it("accepts a number nothing can parse as a submittable answer, since the key may use the same text", () => {
    const { setQuizItemAnswerState } = renderMatrix()
    const firstCell = screen.getByLabelText("matrix-cell-aria-label row=1 column=1")
    fireEvent.change(firstCell, { target: { value: "1,234,567" } })
    expect(setQuizItemAnswerState).toHaveBeenCalledWith(expect.objectContaining({ valid: true }))
  })

  it("refuses a submission with a blank cell inside its own frame", () => {
    const answerWithAGap: UserItemAnswerMatrix = {
      type: "matrix",
      valid: true,
      quizItemId: "matrix-1",
      matrix: [
        ["1", ""],
        ["", "4"],
      ],
    }
    const { setQuizItemAnswerState } = renderMatrix(answerWithAGap)
    const filledCell = screen.getByLabelText("matrix-cell-aria-label row=1 column=1")
    fireEvent.change(filledCell, { target: { value: "9" } })
    expect(setQuizItemAnswerState).toHaveBeenCalledWith(expect.objectContaining({ valid: false }))
  })
})
