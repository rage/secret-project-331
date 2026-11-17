"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import RevealableContentBlock from "../RevealableContentBlock"

jest.mock("@/components/course-material/ContentRenderer", () => ({
  __esModule: true,
  default: ({ data }: { data: { attributes: { text: string } }[] }) => (
    <p>{data[0]?.attributes.text}</p>
  ),
}))

const inner = (name: string, text: string) => ({
  name,
  clientId: text,
  isValid: true,
  attributes: { text },
  innerBlocks: [],
})

const props = {
  id: "r",
  data: {
    name: "moocfi/revealable-content",
    clientId: "r",
    isValid: true,
    attributes: {},
    innerBlocks: [
      inner("core/paragraph", "Think first"),
      inner("moocfi/revealable-hidden-content", "The answer"),
    ],
  },
}

describe("RevealableContentBlock focus", () => {
  it("moves focus into the revealed content", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<RevealableContentBlock {...(props as any)} />)
    expect(screen.queryByText("The answer")).toBeNull()

    fireEvent.click(screen.getByRole("button"))

    const answer = screen.getByText("The answer")
    expect(document.activeElement).toContainElement(answer)
    expect(document.activeElement).not.toBe(document.body)
  })
})
