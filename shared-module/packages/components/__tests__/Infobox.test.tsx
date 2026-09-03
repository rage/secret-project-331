"use client"

import { screen } from "@testing-library/react"

import { Infobox } from "../src/components/Infobox"
import { renderUi } from "./testUtils"

describe("Infobox", () => {
  test("renders the body without claiming to be an alert", () => {
    renderUi(<Infobox>No completions yet</Infobox>)

    expect(screen.getByText("No completions yet")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  test("keeps the tone icon out of the accessible name", () => {
    const { container } = renderUi(<Infobox>Body text</Infobox>)

    expect(container.querySelector("svg")).not.toBeNull()
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull()
    expect(container.firstElementChild).toHaveTextContent("Body text")
  })

  test("renders an optional heading above the body", () => {
    renderUi(<Infobox heading="Heads up">Body text</Infobox>)

    expect(screen.getByText("Heads up")).toBeInTheDocument()
    expect(screen.getByText("Body text")).toBeInTheDocument()
  })

  test("announces politely when asked, and assertively for a warning", () => {
    const { unmount } = renderUi(<Infobox announce>Saved</Infobox>)
    expect(screen.getByRole("status")).toHaveTextContent("Saved")
    unmount()

    renderUi(
      <Infobox tone="warning" announce>
        Not saved
      </Infobox>,
    )
    expect(screen.getByRole("alert")).toHaveTextContent("Not saved")
  })

  test("distinguishes tones by border, not by text alone", () => {
    const { container: info } = renderUi(<Infobox>Text</Infobox>)
    const { container: warning } = renderUi(<Infobox tone="warning">Text</Infobox>)

    const infoBorder = getComputedStyle(info.firstElementChild!).borderColor
    const warningBorder = getComputedStyle(warning.firstElementChild!).borderColor
    expect(infoBorder).not.toBe("")
    expect(warningBorder).not.toBe(infoBorder)
  })

  test("puts the caller's className on the root", () => {
    const { container } = renderUi(<Infobox className="infobox-root">Text</Infobox>)

    expect(container.querySelector(".infobox-root")).toBe(container.firstElementChild)
  })

  test("puts data-testid on the root", () => {
    const { container } = renderUi(<Infobox data-testid="save-hint">Text</Infobox>)

    expect(screen.getByTestId("save-hint")).toBe(container.firstElementChild)
  })
})
