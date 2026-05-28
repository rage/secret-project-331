"use client"

import { css } from "@emotion/css"
import type { UseQueryResult } from "@tanstack/react-query"
import { act, screen } from "@testing-library/react"

import { QueryResult } from "../src/components/queryResult/QueryResult"

import { domClick, renderUi } from "./testUtils"

const edgeContentBorderCss = css`
  border-bottom: 1px solid rgb(118, 123, 133);
`

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

test("renders data", () => {
  renderUi(
    <QueryResult query={makeQuery({ data: "hi" })} themeMode="light">
      {(d: string) => <div>{d}</div>}
    </QueryResult>,
  )

  expect(screen.getByText("hi")).toBeInTheDocument()
})

test("blocking error shows alert and retry calls refetch", () => {
  const refetch = jest.fn()
  renderUi(
    <QueryResult
      query={makeQuery({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("failed"),
        refetch,
      })}
      themeMode="light"
    >
      {() => null}
    </QueryResult>,
  )

  expect(screen.getByRole("alert")).toBeInTheDocument()
  expect(screen.getByText("failed")).toBeInTheDocument()
  domClick(screen.getByRole("button", { name: "Retry" }))
  expect(refetch).toHaveBeenCalledTimes(1)
})

test("stale error keeps content visible", () => {
  renderUi(
    <QueryResult
      query={makeQuery({
        data: "still here",
        isPending: false,
        isError: true,
        error: new Error("stale"),
      })}
      themeMode="light"
    >
      {(d: string) => <div>{d}</div>}
    </QueryResult>,
  )

  expect(screen.getByText("still here")).toBeInTheDocument()
  expect(screen.getByText("stale")).toBeInTheDocument()
})

test("initial loading shows skeleton immediately and status", () => {
  renderUi(
    <QueryResult query={makeQuery({ isPending: true })} themeMode="light" loadingDelayMs={500}>
      {() => null}
    </QueryResult>,
  )

  expect(screen.getByTestId("query-skeleton-blocks")).toBeInTheDocument()
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
})

test("initial loading delays centered spinner until loadingDelayMs", () => {
  jest.useFakeTimers()
  try {
    renderUi(
      <QueryResult query={makeQuery({ isPending: true })} themeMode="light" loadingDelayMs={400}>
        {() => null}
      </QueryResult>,
    )

    expect(screen.queryByTestId("query-loading-spinner")).not.toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(400)
    })
    expect(screen.getByTestId("query-loading-spinner")).toBeInTheDocument()
  } finally {
    jest.useRealTimers()
  }
})

test("empty fallback when data is empty array", () => {
  renderUi(
    <QueryResult<string[]>
      query={makeQuery({ data: [] })}
      themeMode="light"
      emptyFallback={<span>empty-ui</span>}
    >
      {(items) => <span>{items.length}</span>}
    </QueryResult>,
  )

  expect(screen.getByText("empty-ui")).toBeInTheDocument()
})

test("treatNullAsEmpty shows empty fallback for null data", () => {
  renderUi(
    <QueryResult<string | null>
      query={makeQuery({ data: null })}
      themeMode="light"
      treatNullAsEmpty
      emptyFallback={<span>null-empty</span>}
    >
      {(d) => <span>{d}</span>}
    </QueryResult>,
  )

  expect(screen.getByText("null-empty")).toBeInTheDocument()
})

test("refreshing announces status", () => {
  renderUi(
    <QueryResult query={makeQuery({ data: "ok", isRefetching: true })} themeMode="light">
      {(d: string) => <div>{d}</div>}
    </QueryResult>,
  )

  expect(screen.getByText("ok")).toBeInTheDocument()
  expect(screen.getByRole("status", { name: "Refreshing" })).toBeInTheDocument()
})

test("loaded content is not wrapped in a clipping frame", () => {
  renderUi(
    <QueryResult query={makeQuery({ data: "ok" })} themeMode="light">
      {(d: string) => (
        <div data-testid="edge-content" className={edgeContentBorderCss}>
          {d}
        </div>
      )}
    </QueryResult>,
  )

  const content = screen.getByTestId("edge-content")
  const section = content.closest("section")

  expect(section).toBeTruthy()

  let node = content.parentElement
  while (node && node !== section) {
    const styles = getComputedStyle(node)
    expect(styles.overflow).not.toBe("hidden")
    node = node.parentElement
  }
})
