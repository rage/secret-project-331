"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import OutOfTriesNotification from "../OutOfTriesNotification"

// react-i18next is mocked in tests/setup-jest.js, so t() returns the translation key.
describe("OutOfTriesNotification", () => {
  it("renders a persistent status live region even when tries remain", () => {
    render(<OutOfTriesNotification ranOutOfTries={false} />)
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("announces and shows the message when the user has run out of tries (WCAG 4.1.3)", () => {
    render(<OutOfTriesNotification ranOutOfTries={true} />)
    expect(screen.getByRole("status")).toHaveTextContent("out-of-tries-description")
  })
})
