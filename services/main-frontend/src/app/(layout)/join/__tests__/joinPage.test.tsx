"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"

import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

import JoinCoursePage from "../page"

let mockCode: string | null = null
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(mockCode ? { code: mockCode } : {}),
}))

jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  getCourseByJoinCodeOptions: () => ({
    queryKey: ["join-code"],
    queryFn: () => Promise.reject(new Error("Request ID 1234: not found")),
    retry: false,
  }),
  getCourseBreadcrumbInfoOptions: () => ({ queryKey: ["breadcrumbs"], queryFn: () => null }),
}))
jest.mock("@/generated/api/sdk.generated", () => ({ joinCourseWithJoinCode: jest.fn() }))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginStateContext.Provider
        value={{ signedIn: true, isLoading: false, userId: "u", refresh: jest.fn() } as never}
      >
        <JoinCoursePage />
      </LoginStateContext.Provider>
    </QueryClientProvider>,
  )
}

describe("/join", () => {
  it("asks for a join code when none is given", async () => {
    mockCode = null
    renderPage()
    expect(await screen.findByText("join-code-missing")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
  })

  it("explains an invalid code without the raw request id", async () => {
    mockCode = "bad"
    renderPage()
    expect(await screen.findByText("join-code-invalid")).toBeInTheDocument()
    expect(screen.queryByText(/Request ID/)).toBeNull()
  })
})
