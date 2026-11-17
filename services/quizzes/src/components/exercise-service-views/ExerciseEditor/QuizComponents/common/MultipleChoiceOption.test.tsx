import { fireEvent, render, screen } from "@testing-library/react"
import { vi } from "vitest"

import type { QuizItemOption } from "../../../../../../types/quizTypes/privateSpec"
import FlexWrapper from "../../../../FlexWrapper"
import FeedbackMessagesEditor from "./FeedbackMessagesEditor"
import MultipleChoiceOption from "./MultipleChoiceOption"

// Keep the interpolation values in the name so the option context is visible.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${Object.values(options).join(" ")}` : key,
  }),
}))

vi.stubGlobal(
  "IntersectionObserver",
  class {
    public observe() {}
    public unobserve() {}
    public disconnect() {}
  },
)

const option = {
  id: "o1",
  title: "Helsinki",
  correct: true,
  feedbackMessages: [],
} as unknown as QuizItemOption

describe("MultipleChoiceOption", () => {
  it("names its buttons with the option title", () => {
    render(<MultipleChoiceOption option={option} onChange={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByRole("button", { name: "edit-option-named Helsinki" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "option-feedback-named Helsinki" })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    expect(screen.getByRole("button", { name: "delete-option-named Helsinki" })).toBeInTheDocument()
  })

  it("names the finish button while editing", () => {
    render(<MultipleChoiceOption option={option} onChange={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "edit-option-named Helsinki" }))

    expect(
      screen.getByRole("button", { name: "finish-editing-option-named Helsinki" }),
    ).toBeInTheDocument()
  })

  it("names the add feedback message button with the option title", () => {
    render(<MultipleChoiceOption option={option} onChange={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "edit-option-named Helsinki" }))
    fireEvent.click(screen.getByRole("button", { name: "option-feedback-named Helsinki" }))

    expect(
      screen.getByRole("button", { name: "add-feedback-message-named Helsinki" }),
    ).toBeInTheDocument()
  })

  it("numbers the feedback message remove buttons", () => {
    render(
      <FeedbackMessagesEditor
        value={[
          { visibility: "when-selected-after-answer", message: "a" },
          { visibility: "when-selected-after-answer", message: "b" },
        ]}
        visibilityOptions={[{ value: "when-selected-after-answer", label: "x" }]}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: "remove-feedback-message-n 1" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "remove-feedback-message-n 2" })).toBeInTheDocument()
  })
})

describe("FlexWrapper", () => {
  it("does not wrap by default and wraps only from sm up", () => {
    const { container } = render(<FlexWrapper wideScreenDirection="row">x</FlexWrapper>)
    const wrapper = container.firstElementChild as HTMLElement
    const css = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      .filter((text) => text.includes(wrapper.className))
      .join("\n")

    const base = css.split("@media")[0] ?? ""
    expect(base).toContain("flex-wrap: nowrap")
    expect(base).not.toContain("flex-wrap: wrap")
    expect(css.slice(css.indexOf("@media"))).toContain("flex-wrap: wrap")
  })
})
