"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import React from "react"

import { useRecordEnrolmentPageVisitOnce } from "../enrolmentActions"

jest.mock("@/generated/api/sdk.generated", () => ({
  recordMyEnrolmentPageVisit: jest.fn(),
}))

const { recordMyEnrolmentPageVisit } = jest.requireMock("@/generated/api/sdk.generated") as {
  recordMyEnrolmentPageVisit: jest.Mock
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe("useRecordEnrolmentPageVisitOnce", () => {
  beforeEach(() => {
    recordMyEnrolmentPageVisit.mockReset()
    recordMyEnrolmentPageVisit.mockResolvedValue(undefined)
  })

  test("sends the visit once the instructions are showing", async () => {
    renderHook(({ shouldRecord }) => useRecordEnrolmentPageVisitOnce("module-1", shouldRecord), {
      wrapper,
      initialProps: { shouldRecord: true },
    })

    await waitFor(() => {
      expect(recordMyEnrolmentPageVisit).toHaveBeenCalledWith({
        path: { course_module_id: "module-1" },
      })
    })
    expect(recordMyEnrolmentPageVisit).toHaveBeenCalledTimes(1)
  })

  test("never sends it before the instructions are showing", async () => {
    renderHook(({ shouldRecord }) => useRecordEnrolmentPageVisitOnce("module-1", shouldRecord), {
      wrapper,
      initialProps: { shouldRecord: false },
    })

    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(recordMyEnrolmentPageVisit).not.toHaveBeenCalled()
  })

  test("does not repeat the call on a later poll of the same page", async () => {
    const { rerender } = renderHook(
      ({ shouldRecord }) => useRecordEnrolmentPageVisitOnce("module-1", shouldRecord),
      { wrapper, initialProps: { shouldRecord: true } },
    )

    await waitFor(() => expect(recordMyEnrolmentPageVisit).toHaveBeenCalledTimes(1))

    rerender({ shouldRecord: true })
    rerender({ shouldRecord: true })

    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(recordMyEnrolmentPageVisit).toHaveBeenCalledTimes(1)
  })
})
