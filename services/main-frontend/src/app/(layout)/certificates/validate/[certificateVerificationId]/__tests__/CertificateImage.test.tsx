"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import type { CertificateDetails } from "@/generated/api/types.generated"

import CertificateImage from "../CertificateImage"

const details: CertificateDetails = {
  name_on_certificate: "Example Learner",
  course_name: "Introduction to Programming",
  course_module_name: "Extra module",
  completion_date: "2026-02-03T10:00:00Z",
  grade: { grade: 4, passed: true },
  verification_id: "verification-1",
}

beforeAll(() => {
  URL.createObjectURL = jest.fn(() => "blob:certificate")
  URL.revokeObjectURL = jest.fn()
})

describe("CertificateImage", () => {
  it("has an h1 and reads the certificate text once, as hidden-but-rendered content", () => {
    render(<CertificateImage certificateBlob={new Blob(["x"])} details={details} />)

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("certificate-heading")
    expect(screen.getByRole("img")).not.toHaveAttribute("aria-describedby")
    const description = document.querySelector("#certificate-details")
    expect(description).not.toBeNull()
    // In the accessibility tree: not hidden, display:none or aria-hidden.
    expect(description).not.toHaveAttribute("hidden")
    expect(description).not.toHaveAttribute("aria-hidden")
    expect(description?.tagName).toBe("DL")
    expect(description).toHaveTextContent("Example Learner")
    expect(description).toHaveTextContent("Introduction to Programming (Extra module)")
    expect(description).toHaveTextContent("2026-02-03")
    expect(description).toHaveTextContent("4")
    expect(description).toHaveTextContent("verification-1")
    expect(screen.getByRole("link", { name: "save-as-png" })).toBeInTheDocument()
  })

  it("omits the grade when the certificate does not show one", () => {
    render(
      <CertificateImage certificateBlob={new Blob(["x"])} details={{ ...details, grade: null }} />,
    )
    expect(screen.queryByText("grade")).not.toBeInTheDocument()
  })

  it("still has an h1 without details", () => {
    render(<CertificateImage certificateBlob={new Blob(["x"])} />)
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole("img")).not.toHaveAttribute("aria-describedby")
  })
})
