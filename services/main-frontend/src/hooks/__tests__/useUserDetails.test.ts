"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import React from "react"

import { getBulkUserDetails } from "@/generated/api/sdk.generated"
import { AppApiError } from "@/shared-module/common/errors/AppApiError"

import {
  isUserDetailsNotFoundError,
  isUserDetailsQueryReady,
  useUserNames,
} from "../useUserDetails"

jest.mock("@/generated/api/sdk.generated", () => ({
  getBulkUserDetails: jest.fn(),
  getUserDetailsByCourses: jest.fn(),
}))

describe("isUserDetailsNotFoundError", () => {
  it("returns true for not_found message key", () => {
    const error = new AppApiError({
      kind: "api",
      status: 403,
      messageKey: "not_found",
    })

    expect(isUserDetailsNotFoundError(error)).toBe(true)
  })

  it("returns true for not_found type", () => {
    const error = new AppApiError({
      kind: "api",
      status: 403,
      type: "not_found",
    })

    expect(isUserDetailsNotFoundError(error)).toBe(true)
  })

  it("returns true for 404 status", () => {
    const error = new AppApiError({
      kind: "api",
      status: 404,
    })

    expect(isUserDetailsNotFoundError(error)).toBe(true)
  })

  it("returns true for non-AppApiError 404 shaped errors", () => {
    expect(isUserDetailsNotFoundError({ status: 404 })).toBe(true)
  })

  it("returns false for unrelated errors", () => {
    const error = new AppApiError({
      kind: "api",
      status: 403,
      messageKey: "forbidden",
    })

    expect(isUserDetailsNotFoundError(error)).toBe(false)
    expect(isUserDetailsNotFoundError(new Error("boom"))).toBe(false)
  })
})

describe("isUserDetailsQueryReady", () => {
  it("returns true when user id exists and course ids is an empty array", () => {
    expect(isUserDetailsQueryReady([], "user-1")).toBe(true)
  })

  it("returns true when user id exists and course ids has values", () => {
    expect(isUserDetailsQueryReady(["course-1"], "user-1")).toBe(true)
  })

  it("returns false when user id is missing", () => {
    expect(isUserDetailsQueryReady([], null)).toBe(false)
  })

  it("returns false when course ids is missing", () => {
    expect(isUserDetailsQueryReady(undefined, "user-1")).toBe(false)
  })
})

describe("useUserNames", () => {
  it("keeps showing names while a changed id list loads", async () => {
    const pending = new Promise<never>(() => {})
    const mocked = getBulkUserDetails as jest.Mock
    mocked.mockResolvedValueOnce([{ user_id: "u1", first_name: "Ada", last_name: "Lovelace" }])
    mocked.mockReturnValueOnce(pending)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children)
    const { result, rerender } = renderHook(({ ids }) => useUserNames("c1", ids), {
      wrapper,
      initialProps: { ids: ["u1"] },
    })
    await waitFor(() => expect(result.current("u1")).toBe("Ada Lovelace"))

    rerender({ ids: ["u1", "u2"] })
    await waitFor(() => expect(mocked).toHaveBeenCalledTimes(2))
    expect(result.current("u1")).toBe("Ada Lovelace")
  })
})
