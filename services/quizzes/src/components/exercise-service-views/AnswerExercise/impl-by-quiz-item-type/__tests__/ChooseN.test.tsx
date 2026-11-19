import { render, screen } from "@testing-library/react"
import { vi } from "vitest"

import type { PublicSpecQuizItemChooseN } from "../../../../../../types/quizTypes/publicSpec"
import ChooseN from "../ChooseN"

const item: PublicSpecQuizItemChooseN = {
  type: "choose-n",
  id: "cn-1",
  order: 0,
  n: 2,
  title: "Pick the fruits",
  body: "Choose two",
  options: [
    { id: "o-1", order: 0, title: "Apple", body: null },
    { id: "o-2", order: 1, title: "Banana", body: null },
  ],
}

describe("ChooseN answer view", () => {
  it("has no headings and names the group by the title", () => {
    render(
      <ChooseN
        quizDirection="column"
        quizItem={item}
        quizItemAnswerState={null}
        // oxlint-disable-next-line typescript/no-explicit-any
        user_information={{} as any}
        setQuizItemAnswerState={vi.fn()}
      />,
    )
    expect(screen.queryAllByRole("heading")).toHaveLength(0)
    expect(screen.getByRole("toolbar", { name: "Pick the fruits" })).toBeInTheDocument()
  })
})
