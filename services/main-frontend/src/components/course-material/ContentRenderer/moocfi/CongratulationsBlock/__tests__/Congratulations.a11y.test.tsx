"use client"

import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"

import Congratulations from "../Congratulations"

import type { UserModuleCompletionStatus } from "@/generated/course-material-api/types.generated"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
const testModule: UserModuleCompletionStatus = {
  certificate_configuration_id: "ccid-1",
  certification_enabled: true,
  completed: true,
  default: false,
  enable_registering_completion_to_uh_open_university: false,
  grade: 5,
  module_id: "module-1",
  name: "Introduction",
  order_number: 1,
  passed: true,
  prerequisite_modules_completed: true,
}

describe("Congratulations block heading hierarchy (issue #55)", () => {
  it("renders the Congratulations heading at level 2, not level 1", () => {
    render(<Congratulations modules={[testModule]} />)

    const congratsHeading = screen.getByRole("heading", { level: 2, name: /congratulations/i })
    expect(congratsHeading.tagName).toBe("H2")
    // The block must not introduce a second H1 (the page already has one).
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  it("renders the module name as an h3 under the h2", () => {
    render(<Congratulations modules={[testModule]} />)

    const moduleHeading = screen.getByRole("heading", { level: 3, name: "Introduction" })
    expect(moduleHeading.tagName).toBe("H3")
  })
})
