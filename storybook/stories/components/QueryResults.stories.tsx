"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { UseQueryResult } from "@tanstack/react-query"

import { QueryResults } from "../../src/shared-module/components"

const paragraphCss = css`
  margin: 0;
`

const meta = {
  title: "Components/QueryResults",
  parameters: {
    docs: {
      description: {
        component:
          "Waits until every query in the tuple has succeeded, then calls `renderData` with the typed data tuple. Shares the same loading, error, and refetch chrome as `QueryResult`.",
      },
    },
  },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function mockQuery<T>(partial: Partial<UseQueryResult<T, Error>>): UseQueryResult<T, Error> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isPending: false,
    isRefetching: false,
    refetch: () => Promise.resolve({} as UseQueryResult<T, Error>),
    ...partial,
  } as UseQueryResult<T, Error>
}

export const SuccessTwoQueries: Story = {
  render: () => (
    <QueryResults
      themeMode="light"
      queries={
        [
          mockQuery({ data: "Course name", isPending: false }),
          mockQuery({ data: 42, isPending: false }),
        ] as never
      }
      renderData={(tuple) => (
        <p className={paragraphCss}>
          {tuple[0]} — {tuple[1]} items
        </p>
      )}
    />
  ),
}

export const Loading: Story = {
  render: () => (
    <QueryResults
      themeMode="light"
      loadingDelayMs={0}
      queries={
        [
          mockQuery({ data: "Ready", isPending: false }),
          mockQuery({ data: undefined, isPending: true }),
        ] as never
      }
      renderData={() => null}
    />
  ),
}

export const BlockingError: Story = {
  render: () => (
    <QueryResults
      themeMode="light"
      queries={
        [
          mockQuery({ data: "Ready", isPending: false }),
          mockQuery({
            data: undefined,
            isPending: false,
            isError: true,
            error: new Error("Second query failed"),
          }),
        ] as never
      }
      renderData={() => null}
    />
  ),
}

export const SuccessDark: Story = {
  render: () => (
    <QueryResults
      themeMode="dark"
      queries={
        [
          mockQuery({ data: "Dark mode", isPending: false }),
          mockQuery({ data: true, isPending: false }),
        ] as never
      }
      renderData={(tuple) => (
        <p className={paragraphCss}>
          {tuple[0]} ({String(tuple[1])})
        </p>
      )}
    />
  ),
}
