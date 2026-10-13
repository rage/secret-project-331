"use client"

import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import type { FuzzyUserSearchResults, UserDetail } from "@/generated/api/types.generated"

import {
  createUser,
  failed,
  fetching,
  fetchingWithPrevious,
  fuzzyResults,
  succeeded,
} from "../__fixtures__/queryFixtures"
import SearchUsersResults from "../SearchUsersResults"
import { deriveSearchUsersState } from "../searchUsersState"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Translation: ({ children }: { children: (t: (key: string) => string) => React.ReactNode }) =>
    children((key) => key),
}))

const renderResults = (
  exactQuery: Parameters<typeof deriveSearchUsersState>[0],
  fuzzyQuery: Parameters<typeof deriveSearchUsersState>[1],
  { isTooShort = false, onRetryFuzzy = jest.fn() } = {},
) =>
  render(
    <SearchUsersResults
      state={deriveSearchUsersState(exactQuery, fuzzyQuery)}
      isTooShort={isTooShort}
      onRetryExact={jest.fn()}
      onRetryFuzzy={onRetryFuzzy}
    />,
  )

describe("SearchUsersResults", () => {
  it("shows only placeholder rows until the exact search answers", () => {
    renderResults(
      fetching<UserDetail[]>(),
      succeeded(fuzzyResults([createUser("similar", "similar@example.com")])),
    )

    expect(screen.queryByText("similar@example.com")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("shows exact matches under their own heading while similar users load", () => {
    renderResults(
      succeeded([createUser("exact", "exact@example.com")]),
      fetching<FuzzyUserSearchResults>(),
    )

    expect(screen.getByText("exact@example.com")).toBeInTheDocument()
    expect(screen.getByText("search-users-group-exact")).toBeInTheDocument()
    expect(screen.getByText("search-users-group-similar")).toBeInTheDocument()
    expect(screen.queryByText("search-users-result-count")).not.toBeInTheDocument()
  })

  it("lists similar users after the exact matches", () => {
    renderResults(
      succeeded([createUser("exact", "exact@example.com")]),
      succeeded(fuzzyResults([createUser("similar", "similar@example.com")])),
    )

    const emails = screen.getAllByText(/@example\.com$/).map((cell) => cell.textContent)
    expect(emails).toEqual(["exact@example.com", "similar@example.com"])
    expect(screen.getByText("search-users-result-count")).toBeInTheDocument()
  })

  it("says no users were found only after both searches answered", async () => {
    const { rerender } = renderResults(succeeded([]), fetching<FuzzyUserSearchResults>())

    expect(screen.queryByText("search-users-no-users-found")).not.toBeInTheDocument()

    rerender(
      <SearchUsersResults
        state={deriveSearchUsersState(succeeded([]), succeeded(fuzzyResults([])))}
        isTooShort={false}
        onRetryExact={jest.fn()}
        onRetryFuzzy={jest.fn()}
      />,
    )

    expect(await screen.findByText("search-users-no-users-found")).toBeInTheDocument()
  })

  it("asks for a longer term instead of searching", () => {
    renderResults(succeeded([]), succeeded(fuzzyResults([])), { isTooShort: true })

    expect(screen.getByText("search-users-too-short")).toBeInTheDocument()
  })

  it("offers a retry when the similar-user search times out", () => {
    const onRetryFuzzy = jest.fn()
    renderResults(
      succeeded([createUser("exact", "exact@example.com")]),
      succeeded(fuzzyResults([], { timed_out: true })),
      { onRetryFuzzy },
    )

    expect(screen.getByText("exact@example.com")).toBeInTheDocument()
    expect(screen.getByText("search-users-similar-timed-out")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "try-again" }))
    expect(onRetryFuzzy).toHaveBeenCalled()
  })

  it("keeps showing exact matches when the similar-user search fails", () => {
    renderResults(succeeded([createUser("exact", "exact@example.com")]), failed())

    expect(screen.getByText("exact@example.com")).toBeInTheDocument()
    expect(screen.getByText("search-users-similar-failed")).toBeInTheDocument()
  })

  it("makes the previous results inert while the new search runs", () => {
    const { container } = renderResults(
      fetchingWithPrevious([createUser("old", "old@example.com")]),
      fetchingWithPrevious(fuzzyResults([])),
    )

    expect(screen.getByText("old@example.com")).toBeInTheDocument()
    expect(container.querySelector("[inert]")).not.toBeNull()
  })
})
