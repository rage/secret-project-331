"use client"

import "@testing-library/jest-dom"
import { act, render, screen } from "@testing-library/react"

import { GlossaryContext } from "@/contexts/course-material/GlossaryContext"

import ParsedText from ".."

const terms = [{ id: "g1", term: "mean", definition: "The average" }]

describe("ParsedText glossary (F-06)", () => {
  it("renders the term into spans that appear after the first scan", async () => {
    const { container } = render(
      <GlossaryContext.Provider value={{ terms: terms as never }}>
        <p>
          <ParsedText text="plain text" tag="span" useWrapperElement={true} />
        </p>
      </GlossaryContext.Provider>,
    )

    // A lazily loaded element (e.g. the LaTeX paragraph) fills in its HTML after mount.
    const host = container.querySelector("span > span") as HTMLElement
    await act(async () => {
      host.innerHTML = 'the arithmetic <strong><span data-glossary-id="g1"></span></strong>, sum'
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50)
      })
    })

    expect(await screen.findByRole("button", { name: "mean" })).toBeInTheDocument()
    expect(container).toHaveTextContent("the arithmetic mean")
  })

  it("does not watch for lazy content when there are no terms", () => {
    const observe = jest.spyOn(MutationObserver.prototype, "observe")
    render(
      <GlossaryContext.Provider value={{ terms: [] }}>
        <ParsedText text="plain text" tag="span" useWrapperElement={true} />
      </GlossaryContext.Provider>,
    )
    expect(observe).not.toHaveBeenCalled()
    observe.mockRestore()
  })
})
