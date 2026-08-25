"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import type { UserCertificate } from "@/generated/api/types.generated"

import { CertificatesList } from "../CertificatesSection"

// t is mocked in tests/setup-jest.js to return the key verbatim.
const certificate = (overrides: Partial<UserCertificate>): UserCertificate => ({
  id: "certificate-1",
  name_on_certificate: "Example Learner",
  verification_id: "verification-1",
  created_at: "2026-02-03T10:00:00Z",
  course_id: "course-1",
  course_name: "Introduction to Programming",
  course_module_name: null,
  ...overrides,
})

describe("CertificatesList", () => {
  it("labels a default module's certificate with the course name", () => {
    render(<CertificatesList certificates={[certificate({})]} />)

    expect(screen.getByText("Introduction to Programming")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "view_certificate" })).toHaveAttribute(
      "href",
      "/certificates/validate/verification-1",
    )
  })

  it("names the module when the certificate is for one", () => {
    render(<CertificatesList certificates={[certificate({ course_module_name: "Part 2" })]} />)

    expect(screen.getByText("Part 2")).toBeInTheDocument()
    expect(screen.getByText(/Introduction to Programming/)).toBeInTheDocument()
  })
})
