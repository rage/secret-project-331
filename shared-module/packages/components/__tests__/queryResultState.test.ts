import type { UseQueryResult } from "@tanstack/react-query"

import {
  getSingleQueryState,
  isQueryDataTupleEmpty,
  isQueryResultEmpty,
} from "../src/components/queryResult/queryResultState"

test("empty detection", () => {
  expect(isQueryResultEmpty([], false)).toBe(true)
  expect(isQueryResultEmpty([1], false)).toBe(false)
  expect(isQueryResultEmpty(undefined, false)).toBe(true)
  expect(isQueryResultEmpty(null, false)).toBe(false)
  expect(isQueryResultEmpty(null, true)).toBe(true)
})

test("tuple empty detection", () => {
  expect(isQueryDataTupleEmpty([[], "x"], false)).toBe(true)
  expect(isQueryDataTupleEmpty([[1], "x"], false)).toBe(false)
})

test("single query loading", () => {
  const state = getSingleQueryState({
    isPending: true,
    data: undefined,
    isError: false,
    isRefetching: false,
  } as UseQueryResult<unknown, unknown>)

  expect(state.initialLoading).toBe(true)
})
