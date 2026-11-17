"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import type { CertificateDetails } from "@/generated/api/types.generated"

import CertificateImage from "../CertificateImage"

let mockLanguage = "en"
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: mockLanguage },
  }),
}))

jest.mock("@/shared-module/components", () => ({
  ...jest.requireActual("@/shared-module/components"),
  CopyButton: ({ value, label }: { value: string; label: string }) => (
    <button type="button" data-value={value}>
      {label}
    </button>
  ),
}))

const details: CertificateDetails = {
  name_on_certificate: "Example Learner",
  course_name: "Introduction to Programming",
  course_module_name: "Extra module",
  completion_date: "2026-02-03T10:00:00Z",
  grade: { grade: 4, passed: true },
  verification_id: "verification-1",
}

const renderCertificate = (d?: CertificateDetails) =>
  render(<CertificateImage certificateBlob={new Blob(["x"])} details={d} />)

const before = (a: Node, b: Node) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeAll(() => {
  URL.createObjectURL = jest.fn(() => "blob:certificate")
  URL.revokeObjectURL = jest.fn()
})

beforeEach(() => {
  mockLanguage = "en"
})

describe("CertificateImage with details", () => {
  it("orders h1, image, save link, h2, details list", () => {
    renderCertificate(details)

    const h1 = screen.getByRole("heading", { level: 1 })
    const img = screen.getByRole("img", { name: "certificate-image-alt" })
    const save = screen.getByRole("link", { name: "save-as-png" })
    const h2 = screen.getByRole("heading", { level: 2, name: "certificate-details-heading" })
    const dl = document.querySelector("dl") as HTMLElement
    expect(h1).toHaveTextContent("certificate-heading")
    expect(before(h1, img)).toBe(true)
    expect(before(img, save)).toBe(true)
    expect(before(save, h2)).toBe(true)
    expect(before(h2, dl)).toBe(true)
  })

  it("shows the details as visible text, once", () => {
    renderCertificate(details)

    expect(screen.getAllByText("Example Learner")).toHaveLength(1)
    expect(screen.getByText("Introduction to Programming (Extra module)")).toBeVisible()
    expect(screen.getByText("verification-1")).toBeVisible()
    expect(screen.getByText("certificate-issued-date")).toBeInTheDocument()
    expect(document.querySelector("#certificate-details")).toBeNull()
  })

  it.each(["en", "fi"])("shows the UTC day, not the local day (%s)", (language) => {
    mockLanguage = language
    renderCertificate({ ...details, completion_date: "2026-02-03T23:30:00Z" })

    const expected = new Intl.DateTimeFormat(language, {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date("2026-02-03T12:00:00Z"))
    expect(screen.getByText(expected)).toBeInTheDocument()
    expect(expected).toContain("3")
  })

  it("renders grade 0", () => {
    renderCertificate({ ...details, grade: { grade: 0, passed: false } })
    expect(screen.getByText("grade")).toBeInTheDocument()
    expect(screen.getByText("0")).toBeInTheDocument()
  })

  it("renders passed or failed when there is no numeric grade", () => {
    const { unmount } = renderCertificate({ ...details, grade: { grade: null, passed: true } })
    expect(screen.getByText("passed")).toBeInTheDocument()
    unmount()
    renderCertificate({ ...details, grade: { grade: null, passed: false } })
    expect(screen.getByText("failed")).toBeInTheDocument()
  })

  it("omits the grade when the certificate does not show one", () => {
    renderCertificate({ ...details, grade: null })
    expect(screen.queryByText("grade")).not.toBeInTheDocument()
  })

  it("has a copy button for the validation link", () => {
    renderCertificate(details)
    expect(screen.getByRole("button", { name: "copy-certificate-link" })).toHaveAttribute(
      "data-value",
      `${window.location.origin}/certificates/validate/verification-1`,
    )
  })

  it("caps the image width", () => {
    renderCertificate(details)
    expect(screen.getByRole("img")).toHaveStyle({ maxWidth: "100%", height: "auto" })
  })
})

describe("CertificateImage without details", () => {
  it("shows the generic heading and long alt, with no details", () => {
    renderCertificate()

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "certificate-for-completing-a-course-module",
    )
    expect(
      screen.getByRole("img", { name: "certificate-for-completing-a-course-module" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument()
    expect(document.querySelector("dl")).toBeNull()
    expect(screen.getByRole("link", { name: "save-as-png" })).toBeInTheDocument()
  })
})
