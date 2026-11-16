"use client"

import "@testing-library/jest-dom"
import { act, fireEvent, render, screen } from "@testing-library/react"

import ReferenceComponent from "../index"

const setupContent = (html: string) => {
  const content = document.createElement("div")
  content.id = "content"
  content.innerHTML = html
  document.body.append(content)
  return content
}

describe("citation links (B-002)", () => {
  afterEach(() => {
    document.querySelector("#content")?.remove()
  })

  it("opens the references and focuses the cited item on click", async () => {
    setupContent('<p><span data-citation-id="a"></span></p>')
    const { container } = render(<ReferenceComponent data={[{ id: "a", text: "Ref text A" }]} />)

    const link = await screen.findByRole("doc-noteref")
    const details = container.querySelector("details") as HTMLDetailsElement
    expect(details.open).toBe(false)

    act(() => {
      fireEvent.click(link)
    })

    expect(details.open).toBe(true)
    expect(document.activeElement).toBe(document.querySelector("#ref-1"))
    expect(document.activeElement).toHaveTextContent("Ref text A")
  })

  it("does not render an unresolved citation as a link", async () => {
    setupContent('<p><span data-citation-id="missing"></span></p>')
    render(<ReferenceComponent data={[]} />)

    const marker = await screen.findByText("[?]")
    expect(marker.closest("a")).toBeNull()
    expect(screen.queryByRole("doc-noteref")).toBeNull()
  })
})
