"use client"

import { css } from "@emotion/css"
import type { UseQueryResult } from "@tanstack/react-query"
import { act, fireEvent, screen } from "@testing-library/react"

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
    isFetching: false,
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
    <QueryResult
      query={makeQuery({ isPending: true, isFetching: true })}
      themeMode="light"
      loadingDelayMs={500}
    >
      {() => null}
    </QueryResult>,
  )

  expect(screen.getByTestId("query-skeleton-blocks")).toBeInTheDocument()
  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
})

test("disabled query with no data renders an empty frame, not an infinite skeleton", () => {
  // enabled: false / skipToken queries stay isPending but never fetch. Without data there is nothing
  // to render, so QueryResult shows neither a skeleton nor children (consumers that want to render
  // without data should not wrap that case in QueryResult).
  renderUi(
    <QueryResult
      query={makeQuery<string>({ data: undefined, isPending: true, isFetching: false })}
      themeMode="light"
    >
      {(d: string) => <div>disabled-{String(d)}</div>}
    </QueryResult>,
  )

  expect(screen.queryByTestId("query-skeleton-blocks")).not.toBeInTheDocument()
  expect(screen.queryByText(/^disabled-/)).not.toBeInTheDocument()
})

test("initial loading delays centered spinner until loadingDelayMs", () => {
  jest.useFakeTimers()
  try {
    renderUi(
      <QueryResult
        query={makeQuery({ isPending: true, isFetching: true })}
        themeMode="light"
        loadingDelayMs={400}
      >
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

test("treatEmptyAsData renders children with empty array data", () => {
  renderUi(
    <QueryResult<string[]>
      query={makeQuery({ data: [] })}
      themeMode="light"
      treatEmptyAsData
      emptyFallback={<span>empty-ui</span>}
    >
      {(items) => <span>count-{items.length}</span>}
    </QueryResult>,
  )

  expect(screen.getByText("count-0")).toBeInTheDocument()
  expect(screen.queryByText("empty-ui")).not.toBeInTheDocument()
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

/** jsdom has no TransitionEvent constructor, so build the event by hand. */
function fireTransitionEnd(element: Element, propertyName: string) {
  const event = new Event("transitionend", { bubbles: true })
  Object.assign(event, { propertyName })
  fireEvent(element, event)
}

test("refreshing marker stays attached until the blur-out transition genuinely ends", () => {
  const { rerender } = renderUi(
    <QueryResult query={makeQuery({ data: "ok", isFetching: true })} themeMode="light">
      {(d: string) => <div>{d}</div>}
    </QueryResult>,
  )

  expect(screen.getByTestId("query-refreshing")).toBeInTheDocument()

  // Query settled but blur-out still running: stay marked busy.
  rerender(
    <QueryResult query={makeQuery({ data: "ok", isFetching: false })} themeMode="light">
      {(d: string) => <div>{d}</div>}
    </QueryResult>,
  )
  const content = screen.getByText("ok").parentElement as HTMLElement
  expect(screen.getByTestId("query-refreshing")).toBeInTheDocument()

  // Wrong property or bubbled from a child: must not unblock.
  fireTransitionEnd(content, "opacity")
  expect(screen.getByTestId("query-refreshing")).toBeInTheDocument()
  fireTransitionEnd(screen.getByText("ok"), "filter")
  expect(screen.getByTestId("query-refreshing")).toBeInTheDocument()

  fireTransitionEnd(content, "filter")
  expect(screen.queryByTestId("query-refreshing")).not.toBeInTheDocument()
})

test("refreshing marker clears via fallback timer when no transitionend arrives", () => {
  jest.useFakeTimers()
  try {
    const { rerender } = renderUi(
      <QueryResult query={makeQuery({ data: "ok", isFetching: true })} themeMode="light">
        {(d: string) => <div>{d}</div>}
      </QueryResult>,
    )

    rerender(
      <QueryResult query={makeQuery({ data: "ok", isFetching: false })} themeMode="light">
        {(d: string) => <div>{d}</div>}
      </QueryResult>,
    )
    expect(screen.getByTestId("query-refreshing")).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(600)
    })
    expect(screen.queryByTestId("query-refreshing")).not.toBeInTheDocument()
  } finally {
    jest.useRealTimers()
  }
})

test("refreshing announces status", () => {
  renderUi(
    <QueryResult query={makeQuery({ data: "ok", isFetching: true })} themeMode="light">
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
