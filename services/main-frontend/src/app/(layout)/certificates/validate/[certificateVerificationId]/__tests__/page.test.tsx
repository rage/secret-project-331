"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import ModuleCertificateVerification from "../page"

interface QueryOpts {
  __kind?: string
  enabled?: boolean
}

const mockUseQuery = jest.fn()
let mockSearch = ""

jest.mock("@tanstack/react-query", () => ({
  useQuery: (opts: QueryOpts) => mockUseQuery(opts),
}))
jest.mock("next/navigation", () => ({
  useParams: () => ({ certificateVerificationId: "id-1" }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}))
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}))
jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  getCertificateByVerificationIdOptions: () => ({ __kind: "image" }),
  getCertificateDetailsByVerificationIdOptions: () => ({ __kind: "details" }),
}))
jest.mock("@/shared-module/common/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }))
jest.mock("@/shared-module/common/utils/withErrorBoundary", () => ({
  __esModule: true,
  default: (c: unknown) => c,
}))
jest.mock("@/shared-module/common/utils/withSuspenseBoundary", () => ({
  __esModule: true,
  default: (c: unknown) => c,
}))
jest.mock("../CertificateImage", () => ({
  __esModule: true,
  default: ({ details }: { details?: unknown }) => (
    <h1>{details ? "details-view" : "fallback-view"}</h1>
  ),
}))

const imageOk = { isSuccess: true, isLoading: false, isError: false, data: new Blob(["x"]) }

const setup = (details: Record<string, unknown>) => {
  mockUseQuery.mockImplementation((opts: QueryOpts) =>
    opts.__kind === "details" ? details : imageOk,
  )
}

beforeEach(() => {
  mockSearch = ""
  mockUseQuery.mockReset()
})

describe("certificate validate page", () => {
  it("shows a spinner, not the heading, while details load", () => {
    setup({ isLoading: true, data: undefined })
    render(<ModuleCertificateVerification />)

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  it("falls back to the image only when details fail", () => {
    setup({ isLoading: false, isError: true, data: undefined })
    render(<ModuleCertificateVerification />)

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("fallback-view")
  })

  it("does not fetch details in debug mode", () => {
    mockSearch = "debug=true"
    setup({ isLoading: false, data: undefined })
    render(<ModuleCertificateVerification />)

    const detailsCall = mockUseQuery.mock.calls
      .map(([o]) => o as QueryOpts)
      .find((o) => o.__kind === "details")
    expect(detailsCall?.enabled).toBe(false)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("fallback-view")
  })
})
