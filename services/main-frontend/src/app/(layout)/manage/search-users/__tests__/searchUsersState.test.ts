import type { FuzzyUserSearchResults, UserDetail } from "@/generated/api/types.generated"

import {
  createUser,
  fetching,
  fetchingWithPrevious,
  fuzzyResults,
  succeeded,
} from "../__fixtures__/queryFixtures"
import { deriveSearchUsersState } from "../searchUsersState"

describe("deriveSearchUsersState", () => {
  it("shows exact matches before the fuzzy search answers", () => {
    const state = deriveSearchUsersState(
      succeeded([createUser("exact")]),
      fetching<FuzzyUserSearchResults>(),
    )

    expect(state.exactUsers.map((user) => user.user_id)).toEqual(["exact"])
    expect(state.similarUsers).toBeNull()
    expect(state.resultCount).toBeNull()
  })

  it("leaves exact matches out of the similar users", () => {
    const state = deriveSearchUsersState(
      succeeded([createUser("exact")]),
      succeeded(fuzzyResults([createUser("exact"), createUser("similar")])),
    )

    expect(state.similarUsers?.map((user) => user.user_id)).toEqual(["similar"])
    expect(state.resultCount).toBe(2)
  })

  it("keeps the previous results until the exact search for the new query answers", () => {
    const state = deriveSearchUsersState(
      fetchingWithPrevious([createUser("old-exact")]),
      fetchingWithPrevious(fuzzyResults([createUser("old-similar")])),
    )

    expect(state.isExactSettled).toBe(false)
    expect(state.previous?.exactUsers.map((user) => user.user_id)).toEqual(["old-exact"])
    expect(state.previous?.similarUsers.map((user) => user.user_id)).toEqual(["old-similar"])
  })

  it("drops the previous results once the exact search answers", () => {
    const state = deriveSearchUsersState(
      succeeded<UserDetail[]>([]),
      fetchingWithPrevious(fuzzyResults([createUser("old-similar")])),
    )

    expect(state.previous).toBeNull()
    expect(state.similarUsers).toBeNull()
  })
})
