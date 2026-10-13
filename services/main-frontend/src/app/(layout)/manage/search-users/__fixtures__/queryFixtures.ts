import type { UseQueryResult } from "@tanstack/react-query"

import type { FuzzyUserSearchResults, UserDetail } from "@/generated/api/types.generated"

export const createUser = (user_id: string, email = `${user_id}@example.com`): UserDetail => ({
  user_id,
  email,
  first_name: "Alice",
  last_name: "Example",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
})

export const createQuery = <T>(
  overrides: Partial<UseQueryResult<T, unknown>> = {},
): UseQueryResult<T, unknown> =>
  ({
    data: undefined,
    error: null,
    isError: false,
    isSuccess: false,
    isFetching: false,
    isPending: true,
    isPlaceholderData: false,
    ...overrides,
  }) as UseQueryResult<T, unknown>

export const succeeded = <T>(data: T): UseQueryResult<T, unknown> =>
  createQuery<T>({ data, isSuccess: true, isPending: false })

export const fetching = <T>(): UseQueryResult<T, unknown> => createQuery<T>({ isFetching: true })

/** Still fetching the current query while showing the previous query's data. */
export const fetchingWithPrevious = <T>(data: T): UseQueryResult<T, unknown> =>
  createQuery<T>({
    data,
    isSuccess: true,
    isPending: false,
    isFetching: true,
    isPlaceholderData: true,
  })

export const failed = <T>(): UseQueryResult<T, unknown> =>
  createQuery<T>({ isError: true, isPending: false, error: new Error("Search failed") })

export const fuzzyResults = (
  users: UserDetail[],
  overrides: Partial<FuzzyUserSearchResults> = {},
): FuzzyUserSearchResults => ({ users, has_more: false, timed_out: false, ...overrides })
