"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { screen } from "@testing-library/react"

import { QueryResult } from "../src/components/queryResult/QueryResult"

import { renderUi } from "./testUtils"

test("renders data", () => {
  renderUi(
    <QueryResult
      query={
        {
          data: "hi",
          isPending: false,
          isError: false,
          isRefetching: false,
        } as UseQueryResult<string, unknown>
      }
      themeMode="light"
    >
      {(d: string) => <div>{d}</div>}
    </QueryResult>,
  )

  expect(screen.getByText("hi")).toBeInTheDocument()
})
