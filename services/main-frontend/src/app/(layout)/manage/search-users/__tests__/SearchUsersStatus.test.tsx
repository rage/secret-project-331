"use client"

import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import type { FuzzyUserSearchResults, UserDetail } from "@/generated/api/types.generated"

import { createUser, fetching, fuzzyResults, succeeded } from "../__fixtures__/queryFixtures"
import { deriveSearchUsersState } from "../searchUsersState"
import SearchUsersStatus from "../SearchUsersStatus"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const renderStatus = (
  exactQuery: Parameters<typeof deriveSearchUsersState>[0],
  fuzzyQuery: Parameters<typeof deriveSearchUsersState>[1],
  { searchQuery = "alice", isTooShort = false } = {},
) =>
  render(
    <SearchUsersStatus
      state={deriveSearchUsersState(exactQuery, fuzzyQuery)}
      searchQuery={searchQuery}
      isTooShort={isTooShort}
    />,
  )

describe("SearchUsersStatus", () => {
  it("says nothing before the exact search answers", () => {
    const { container } = renderStatus(fetching<UserDetail[]>(), fetching<FuzzyUserSearchResults>())

    expect(container.querySelector("p")).toBeEmptyDOMElement()
  })

  it("counts exact matches while similar users load", () => {
    renderStatus(succeeded([createUser("exact")]), fetching<FuzzyUserSearchResults>())

    expect(screen.getByText("search-users-exact-count-looking-for-similar")).toBeInTheDocument()
  })

  it("counts all users once both searches answered", () => {
    renderStatus(
      succeeded([createUser("exact")]),
      succeeded(fuzzyResults([createUser("similar")], { has_more: true })),
    )

    expect(
      screen.getByText("search-users-result-count search-users-more-similar"),
    ).toBeInTheDocument()
  })
})
