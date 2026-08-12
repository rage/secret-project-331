"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type React from "react"

import type { UserDetail } from "@/generated/api/types.generated"

import SearchUsersResults from "../SearchUsersResults"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { completed?: number }) => {
      if (key === "search-users-progress") {
        return `Searches completed: ${options?.completed ?? 0}/3`
      }
      return key
    },
  }),
  Translation: ({ children }: { children: (t: (key: string) => string) => React.ReactNode }) =>
    children((key) => key),
}))

const createUser = (user_id: string, email: string): UserDetail => ({
  user_id,
  email,
  first_name: "Alice",
  last_name: "Example",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
})

const createQuery = (
  overrides: Partial<UseQueryResult<UserDetail[], unknown>> = {},
): UseQueryResult<UserDetail[], unknown> =>
  ({
    data: [],
    error: null,
    isError: false,
    isFetching: false,
    isPending: false,
    ...overrides,
  }) as UseQueryResult<UserDetail[], unknown>

const renderSearchUsersResults = (
  overrides: Partial<{
    searchByEmailQuery: UseQueryResult<UserDetail[], unknown>
    searchByOtherDetailsQuery: UseQueryResult<UserDetail[], unknown>
    searchFuzzyMatchQuery: UseQueryResult<UserDetail[], unknown>
  }> = {},
) =>
  render(
    <SearchUsersResults
      searchByEmailQuery={overrides.searchByEmailQuery ?? createQuery()}
      searchByOtherDetailsQuery={overrides.searchByOtherDetailsQuery ?? createQuery()}
      searchFuzzyMatchQuery={overrides.searchFuzzyMatchQuery ?? createQuery()}
    />,
  )

describe("SearchUsersResults", () => {
  it("renders partial table rows while a query is still fetching", () => {
    renderSearchUsersResults({
      searchByEmailQuery: createQuery({
        data: [createUser("user-1", "alice@example.com")],
      }),
      searchByOtherDetailsQuery: createQuery({ data: undefined, isFetching: true }),
    })

    expect(screen.getByText("alice@example.com")).toBeInTheDocument()
    expect(screen.getByText("Searches completed: 2/3")).toBeInTheDocument()
    expect(screen.queryByText("text-no-results")).not.toBeInTheDocument()
  })

  it("shows progress while query slots are still completing", () => {
    const { rerender } = renderSearchUsersResults({
      searchByEmailQuery: createQuery({ isFetching: true }),
      searchByOtherDetailsQuery: createQuery({ isFetching: true }),
    })

    expect(screen.getByText("Searches completed: 1/3")).toBeInTheDocument()

    rerender(
      <SearchUsersResults
        searchByEmailQuery={createQuery()}
        searchByOtherDetailsQuery={createQuery({ isFetching: true })}
        searchFuzzyMatchQuery={createQuery()}
      />,
    )

    expect(screen.getByText("Searches completed: 2/3")).toBeInTheDocument()

    rerender(
      <SearchUsersResults
        searchByEmailQuery={createQuery()}
        searchByOtherDetailsQuery={createQuery()}
        searchFuzzyMatchQuery={createQuery()}
      />,
    )

    expect(screen.queryByText("Searches completed: 3/3")).not.toBeInTheDocument()
  })

  it("shows no results only after all query slots have completed", () => {
    const { rerender } = renderSearchUsersResults({
      searchByEmailQuery: createQuery({ isFetching: true }),
    })

    expect(screen.queryByText("text-no-results")).not.toBeInTheDocument()

    rerender(
      <SearchUsersResults
        searchByEmailQuery={createQuery()}
        searchByOtherDetailsQuery={createQuery()}
        searchFuzzyMatchQuery={createQuery()}
      />,
    )

    expect(screen.getByText("text-no-results")).toBeInTheDocument()
  })

  it("renders successful partial results when one query errors", () => {
    renderSearchUsersResults({
      searchByEmailQuery: createQuery({
        data: [createUser("user-1", "alice@example.com")],
      }),
      searchByOtherDetailsQuery: createQuery({
        error: new Error("Search failed"),
        isError: true,
      }),
    })

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("alice@example.com")).toBeInTheDocument()
  })
})
