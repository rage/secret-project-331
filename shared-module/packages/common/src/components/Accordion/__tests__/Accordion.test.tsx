import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import DetailAccordion from "../index"

describe("DetailAccordion", () => {
  it("renders accordion with summary and content", () => {
    render(
      <DetailAccordion>
        <details>
          <summary>Accordion Title</summary>
          <div>Accordion Content</div>
        </details>
      </DetailAccordion>,
    )
    expect(screen.getByText("Accordion Title")).toBeInTheDocument()
    expect(screen.getByText("Accordion Content")).not.toBeVisible()
    fireEvent.click(screen.getByText("Accordion Title"))
    expect(screen.getByText("Accordion Content")).toBeVisible()
  })

  it("applies custom className when provided", () => {
    const { container } = render(
      <DetailAccordion className="custom-class">
        <details>
          <summary>Title</summary>
          <div>Content</div>
        </details>
      </DetailAccordion>,
    )

    expect(container.firstChild).toHaveClass("custom-class")
  })
})
