"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"

import { QueryResults } from "../src/components/queryResult/QueryResults"

import { renderUi } from "./testUtils"

test("empty tuple", () => {
  const { container } = render(
    <QueryResults queries={[]} themeMode="light" renderData={() => null} />,
  )
  expect(container).toBeEmptyDOMElement()
})

test("renders when all queries have data", () => {
  const queries = [
    { data: "a", isPending: false, isError: false, isRefetching: false },
    { data: "b", isPending: false, isError: false, isRefetching: false },
  ] as unknown as readonly [UseQueryResult<string, unknown>, UseQueryResult<string, unknown>]

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
