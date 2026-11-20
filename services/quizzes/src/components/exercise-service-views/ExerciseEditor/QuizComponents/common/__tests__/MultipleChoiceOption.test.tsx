import { fireEvent, render, screen } from "@testing-library/react"
import { vi } from "vitest"

import MultipleChoiceOption from "../MultipleChoiceOption"

const option = {
  id: "o1",
  order: 1,
  title: "Foobar",
  body: null,
  correct: false,
  feedbackMessages: [],
}

describe("MultipleChoiceOption", () => {
  it("reports a Correct toggle immediately, without a separate confirm step", () => {
    const onChange = vi.fn()
    render(<MultipleChoiceOption option={option} onChange={onChange} onDelete={vi.fn()} />)
    fireEvent.click(screen.getAllByRole("button")[0]!)
    fireEvent.click(screen.getByRole("checkbox"))
    expect(onChange).toHaveBeenCalledWith({ correct: true })
  })

  it("reports title edits immediately", () => {
    const onChange = vi.fn()
    render(<MultipleChoiceOption option={option} onChange={onChange} onDelete={vi.fn()} />)
    fireEvent.click(screen.getAllByRole("button")[0]!)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Baz" } })
    expect(onChange).toHaveBeenCalledWith({ title: "Baz" })
  })
})
