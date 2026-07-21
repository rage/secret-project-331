import { act, fireEvent, render, screen } from "@testing-library/react"
import { vi } from "vitest"

import type { UserItemAnswerScale } from "../../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItemScale } from "../../../../../../types/quizTypes/publicSpec"
import Scale from "../Scale"

// ParsedText renders via dynamicImport (React.lazy); mock it so the question text is present
// synchronously for the accessible-name assertions.
vi.mock("../../../../ParsedText", () => ({
  __esModule: true,
  default: ({ text }: { text: string | null }) => <span>{text}</span>,
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

const baseItem: PublicSpecQuizItemScale = {
  type: "scale",
  id: "scale-1",
  order: 0,
  minValue: 1,
  maxValue: 5,
  minLabel: null,
  maxLabel: null,
  optionAnswers: null,
  title: "How confident are you?",
  body: null,
}

const renderScale = (
  overrides: Partial<PublicSpecQuizItemScale> = {},
  answer: UserItemAnswerScale | null = null,
) => {
  const setQuizItemAnswerState = vi.fn()
  const utils = render(
    <Scale
      quizDirection="column"
      quizItem={{ ...baseItem, ...overrides }}
      quizItemAnswerState={answer}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user_information={{} as any}
      setQuizItemAnswerState={setQuizItemAnswerState}
    />,
  )
  return { ...utils, setQuizItemAnswerState }
}

describe("Scale accessibility", () => {
  it("exposes a radiogroup named after the visible question (WCAG 1.3.1)", () => {
    renderScale()
    const group = screen.getByRole("radiogroup", { name: /How confident are you\?/ })
    expect(group).toBeInTheDocument()
  })

  it("renders one labelled radio per scale step", () => {
    renderScale()
    const radios = screen.getAllByRole("radio")
    expect(radios).toHaveLength(5)
    for (const value of ["1", "2", "3", "4", "5"]) {
      expect(screen.getByRole("radio", { name: value })).toBeInTheDocument()
    }
  })

  it("reflects the stored answer as the checked radio", () => {
    renderScale({}, { type: "scale", quizItemId: "scale-1", intData: 3, valid: true })
    expect(screen.getByRole("radio", { name: "3" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "1" })).not.toBeChecked()
  })

  it("stores the selection when a radio is chosen", () => {
    const { setQuizItemAnswerState } = renderScale()
    fireEvent.click(screen.getByRole("radio", { name: "4" }))
    expect(setQuizItemAnswerState).toHaveBeenCalledWith(
      expect.objectContaining({ intData: 4, valid: true }),
    )
  })

  it("shows a visible focus indicator on keyboard focus (WCAG 2.4.7)", () => {
    renderScale()
    // Establish keyboard modality so react-aria treats the focus as keyboard-driven.
    fireEvent.keyDown(document.body, { key: "Tab" })
    const radio = screen.getByRole("radio", { name: "2" })
    act(() => {
      radio.focus()
    })
    const label = radio.closest("label")
    expect(label).not.toBeNull()
    expect(label?.querySelector('[data-focus-visible="true"]')).not.toBeNull()
    expect(allCssText()).toMatch(/data-focus-visible="true"[^}]*outline/)
  })

  it("uses an unchecked ring color with >= 3:1 contrast instead of the failing light gray", () => {
    renderScale()
    const styleText = allCssText()
    // jsdom's CSSOM serializes hex colors to rgb(), so accept either form of #767b85.
    expect(styleText).toMatch(/#767b85|rgb\(118,\s*123,\s*133\)/i)
    expect(styleText).not.toContain("#dfe1e6")
  })
})
