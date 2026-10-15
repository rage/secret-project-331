"use client"

import { AppApiError } from "@/shared-module/common/errors/AppApiError"

import { isUserDetailsNotFoundError, isUserDetailsQueryReady } from "../useUserDetails"

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
