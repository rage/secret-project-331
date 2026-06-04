"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { screen } from "@testing-library/react"

import { QueryResults } from "../src/components/queryResult/QueryResults"

import { domClick, renderUi } from "./testUtils"

function makeQuery<T, E = unknown>(partial: Partial<UseQueryResult<T, E>>): UseQueryResult<T, E> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isPending: false,
    isRefetching: false,
    refetch: jest.fn(),
    ...partial,
  } as UseQueryResult<T, E>
}

test("empty tuple", () => {
  const { container } = renderUi(
    <QueryResults queries={[]} themeMode="light" renderData={() => null} />,
  )
  expect(container).toBeEmptyDOMElement()
})

test("renders when all queries have data", () => {
  const queries = [makeQuery({ data: "a" }), makeQuery({ data: "b" })] as unknown as readonly [
    UseQueryResult<string, unknown>,
    UseQueryResult<string, unknown>,
  ]

  renderUi(
    <QueryResults
      themeMode="light"
      queries={queries}
      renderData={(tuple) => (
        <div>
          {String(tuple[0])},{String(tuple[1])}
        </div>
      )}
    />,
  )

  expect(screen.getByText("a,b")).toBeInTheDocument()
})

test("blocking error and retry refetches only failed queries", () => {
  const refetchOk = jest.fn()
  const refetchFail = jest.fn()
  const queries = [
    makeQuery({ data: "a", refetch: refetchOk }),
    makeQuery({
      data: undefined,
      isError: true,
      error: new Error("nope"),
      refetch: refetchFail,
    }),
  ] as unknown as readonly [UseQueryResult<string, unknown>, UseQueryResult<string, unknown>]

  renderUi(<QueryResults themeMode="light" queries={queries} renderData={() => null} />)

  expect(screen.getByRole("alert")).toBeInTheDocument()
  domClick(screen.getByRole("button", { name: "Retry" }))
  expect(refetchFail).toHaveBeenCalledTimes(1)
  expect(refetchOk).not.toHaveBeenCalled()
})

test("stale error retry refetches only errored queries", () => {
  const refetchOk = jest.fn()
  const refetchStale = jest.fn()
  const queries = [
    makeQuery({ data: "a", refetch: refetchOk }),
    makeQuery({
      data: "b",
      isError: true,
      error: new Error("stale"),
      refetch: refetchStale,
    }),
  ] as unknown as readonly [UseQueryResult<string, unknown>, UseQueryResult<string, unknown>]

  renderUi(
    <QueryResults
      themeMode="light"
      queries={queries}
      renderData={(t) => (
        <span>
          {t[0]},{t[1]}
        </span>
      )}
    />,
  )

  domClick(screen.getByRole("button", { name: "Retry" }))
  expect(refetchStale).toHaveBeenCalledTimes(1)
  expect(refetchOk).not.toHaveBeenCalled()
})

test("empty fallback when any tuple slot is empty array", () => {
  const queries = [
    makeQuery({ data: [] as string[] }),
    makeQuery({ data: "x" }),
  ] as unknown as readonly [UseQueryResult<string[], unknown>, UseQueryResult<string, unknown>]

  renderUi(
    <QueryResults
      themeMode="light"
      queries={queries}
      emptyFallback={<span>tuple-empty</span>}
      renderData={() => <span>data</span>}
    />,
  )

  expect(screen.getByText("tuple-empty")).toBeInTheDocument()
})

test("treatEmptyAsData renders data even when a tuple slot is an empty array", () => {
  const queries = [
    makeQuery({ data: [] as string[] }),
    makeQuery({ data: "x" }),
  ] as unknown as readonly [UseQueryResult<string[], unknown>, UseQueryResult<string, unknown>]

  renderUi(
    <QueryResults
      themeMode="light"
      queries={queries}
      treatEmptyAsData
      emptyFallback={<span>tuple-empty</span>}
      renderData={(t) => <span>count-{t[0].length}</span>}
    />,
  )

  expect(screen.getByText("count-0")).toBeInTheDocument()
  expect(screen.queryByText("tuple-empty")).not.toBeInTheDocument()
})

test("initial loading shows skeleton", () => {
  const queries = [
    makeQuery({ data: "a" }),
    makeQuery({ isPending: true }),
  ] as unknown as readonly [UseQueryResult<string, unknown>, UseQueryResult<string, unknown>]

  renderUi(<QueryResults themeMode="light" queries={queries} renderData={() => null} />)

  expect(screen.getByTestId("query-skeleton-blocks")).toBeInTheDocument()
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
})

test("refreshing announces status", () => {
  const queries = [
    makeQuery({ data: "a" }),
    makeQuery({ data: "b", isRefetching: true }),
  ] as unknown as readonly [UseQueryResult<string, unknown>, UseQueryResult<string, unknown>]

  renderUi(
    <QueryResults
      themeMode="light"
      queries={queries}
      renderData={(t) => (
        <span>
          {t[0]},{t[1]}
        </span>
      )}
    />,
  )

  expect(screen.getByText("a,b")).toBeInTheDocument()
  expect(screen.getByRole("status", { name: "Refreshing" })).toBeInTheDocument()
})

test("treatNullAsEmpty uses empty fallback when any slot is null", () => {
  const queries = [makeQuery({ data: null }), makeQuery({ data: "x" })] as unknown as readonly [
    UseQueryResult<string | null, unknown>,
    UseQueryResult<string, unknown>,
  ]

  renderUi(
    <QueryResults
      themeMode="light"
      queries={queries}
      treatNullAsEmpty
      emptyFallback={<span>null-slot</span>}
      renderData={() => <span>data</span>}
    />,
  )

  expect(screen.getByText("null-slot")).toBeInTheDocument()
})
