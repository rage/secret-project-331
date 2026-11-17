"use client"

import "@testing-library/jest-dom"
import { act, fireEvent, render, screen } from "@testing-library/react"

import FlipCardBlock from "../FlipCardBlock"

jest.mock("@/components/course-material/ContentRenderer", () => ({
  __esModule: true,
  default: ({ data }: { data: { attributes: { text: string } }[] }) => (
    <p>{data[0]?.attributes.text}</p>
  ),
}))

const side = (text: string) => ({
  name: "moocfi/inner-card",
  clientId: text,
  isValid: true,
  attributes: { text },
  innerBlocks: [],
})

const props = {
  id: "flip",
  data: {
    name: "moocfi/flip-card",
    clientId: "flip",
    isValid: true,
    attributes: { size: "m" },
    innerBlocks: [side("front text"), side("back text")],
  },
}

describe("FlipCardBlock focus", () => {
  it("does not move focus on mount", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<FlipCardBlock {...(props as any)} />)
    expect(document.activeElement).toBe(document.body)
  })

  it("moves focus to the visible side's button after a user flip", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<FlipCardBlock {...(props as any)} />)
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "button-text-flip-to-back" }))
    })
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "button-text-flip-to-front" }),
    )
  })

  it("keeps the flip button in the flow of the side, after its content", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<FlipCardBlock {...(props as any)} />)
    const front = screen.getByTestId("flip-card-front")
    expect(front.lastElementChild).toBe(screen.getByRole("button"))
  })
})
