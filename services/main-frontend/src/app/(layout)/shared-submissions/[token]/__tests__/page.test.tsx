"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"

import type { SharedSubmissionInfo } from "@/generated/api/types.generated"

import SharedSubmissionPage from "../page"

jest.mock("react-i18next", () => {
  const en: Record<string, string> = jest.requireActual(
    "@/shared-module/common/locales/en/main-frontend.json",
  )
  const t = (key: string, options: Record<string, string> = {}) =>
    (en[key] ?? key).replaceAll(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options[name]))
  return { useTranslation: () => ({ t }) }
})

jest.mock("next/navigation", () => ({ useParams: () => ({ token: "share-token" }) }))

jest.mock("@/shared-module/common/contexts/LoginStateContext", () => ({
  withSignedIn: <T,>(Component: T) => Component,
}))

jest.mock("@/shared-module/common/hooks/usePageTitle", () => ({ usePageTitle: () => {} }))

jest.mock("@/app/(layout)/submissions/[id]/grading/SubmissionIFrame", () => ({
  __esModule: true,
  default: () => null,
}))

let mockSharedSubmission: SharedSubmissionInfo

jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  getSharedSubmissionInfoOptions: () => ({
    queryKey: ["shared-submission"],
    queryFn: () => Promise.resolve(mockSharedSubmission),
  }),
}))

const EXERCISE_PAGE_URL = "http://project-331.local/org/uh-cs/courses/intro/chapter-1/hello"

function renderPage(isGraded: boolean) {
  mockSharedSubmission = {
    exercise: { name: "Hello world", score_maximum: 2 },
    tasks: [],
    created_at: "2026-11-12T10:00:00Z",
    is_graded: isGraded,
    exercise_page_url: EXERCISE_PAGE_URL,
  } as unknown as SharedSubmissionInfo
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <SharedSubmissionPage />
    </QueryClientProvider>,
  )
}

describe("Shared submission page", () => {
  it("says an ungraded snapshot was saved, not submitted, and shows no points", async () => {
    renderPage(false)

    expect(await screen.findByTestId("shared-submission-not-graded")).toBeInTheDocument()
    expect(screen.getByText(/^Saved \d/)).toBeInTheDocument()
    expect(screen.getByText("Shared copy")).toBeInTheDocument()
    expect(screen.getByText("Saved copy:")).toBeInTheDocument()
    expect(screen.queryByText(/Shared submission/)).not.toBeInTheDocument()
    expect(screen.queryByTestId("submission-points")).not.toBeInTheDocument()
  })

  it("names the exercise once as the heading, linking to its material page", async () => {
    renderPage(true)

    const heading = await screen.findByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent("Hello world")
    expect(screen.getByRole("link", { name: "Hello world" })).toHaveAttribute(
      "href",
      EXERCISE_PAGE_URL,
    )
    expect(screen.getAllByText("Shared submission")).toHaveLength(1)
  })

  it("shows points for a graded submission", async () => {
    renderPage(true)

    expect(await screen.findByTestId("submission-points")).toBeInTheDocument()
    expect(screen.getByText(/^Submitted /)).toBeInTheDocument()
    expect(screen.queryByTestId("shared-submission-not-graded")).not.toBeInTheDocument()
  })
})
