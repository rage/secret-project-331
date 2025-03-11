import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import { AccordionProvider, useAccordionContext } from "../accordionContext"
import Accordion from "../index"

describe("DetailAccordion", () => {
  it("renders accordion with summary and content", () => {
    render(
      <Accordion>
        <details>
          <summary>Accordion Title</summary>
          <div>Accordion Content</div>
        </details>
      </Accordion>,
    )
    expect(screen.getByText("Accordion Title")).toBeInTheDocument()
    expect(screen.getByText("Accordion Content")).not.toBeVisible()
    fireEvent.click(screen.getByText("Accordion Title"))
    expect(screen.getByText("Accordion Content")).toBeVisible()
  })

  it("applies custom className when provided", () => {
    const { container } = render(
      <Accordion className="custom-class">
        <details>
          <summary>Title</summary>
          <div>Content</div>
        </details>
      </Accordion>,
    )

    expect(container.firstChild).toHaveClass("custom-class")
  })

  describe("with AccordionProvider", () => {
    it("integrates with context for expand/collapse functionality", () => {
      const AccordionWithControls = () => {
        const { expandAll, collapseAll } = useAccordionContext()
        return (
          <div>
            <div>
              <button onClick={expandAll}>Expand All</button>
              <button onClick={collapseAll}>Collapse All</button>
            </div>
            <Accordion>
              <details>
                <summary>First Accordion</summary>
                <div>Content</div>
              </details>
            </Accordion>
            <Accordion>
              <details>
                <summary>Second Accordion</summary>
                <div>Content 2</div>
              </details>
            </Accordion>
          </div>
        )
      }

      render(
        <AccordionProvider>
          <AccordionWithControls />
        </AccordionProvider>,
      )

      expect(screen.getByText("Content")).not.toBeVisible()
      expect(screen.getByText("Content 2")).not.toBeVisible()

      fireEvent.click(screen.getByText("Expand All"))
      expect(screen.getByText("Content")).toBeVisible()
      expect(screen.getByText("Content 2")).toBeVisible()

      fireEvent.click(screen.getByText("Collapse All"))
      expect(screen.getByText("Content")).not.toBeVisible()
      expect(screen.getByText("Content 2")).not.toBeVisible()
    })
  })
})
