import type { UseQueryResult } from "@tanstack/react-query"

import {
  getMultiQueryState,
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
    isFetching: true,
    data: undefined,
    isError: false,
    isRefetching: false,
  } as UseQueryResult<unknown, unknown>)

  expect(state.initialLoading).toBe(true)
})

test("disabled query is not treated as loading", () => {
  // enabled: false / skipToken queries stay isPending forever but never fetch.
  const state = getSingleQueryState({
    isPending: true,
    isFetching: false,
    data: undefined,
    isError: false,
    isRefetching: false,
  } as UseQueryResult<unknown, unknown>)

  expect(state.initialLoading).toBe(false)
})

test("disabled query in tuple keeps the combined view blank (no loading, no error)", () => {
  // One query succeeded, the other is disabled (enabled: false / skipToken): it
  // stays isPending forever but never fetches. allHaveData stays false, so the
  // combined view renders blank with no loading and no error.
  const success = {
    isPending: false,
    isFetching: false,
    data: "a",
    isError: false,
    isRefetching: false,
  } as UseQueryResult<unknown, unknown>
  const disabled = {
    isPending: true,
    isFetching: false,
    data: undefined,
    isError: false,
    isRefetching: false,
  } as UseQueryResult<unknown, unknown>

  const state = getMultiQueryState([success, disabled] as const)

  expect(state.allHaveData).toBe(false)
  expect(state.initialLoading).toBe(false)
  expect(state.refreshing).toBe(false)
  expect(state.blockingError).toBe(false)
  expect(state.staleError).toBe(false)
  expect(state.dataTuple).toBe(undefined)
})
