"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { UseQueryResult } from "@tanstack/react-query"

import { QueryResult } from "../../src/shared-module/components"

const paragraphCss = css`
  margin: 0;
`

const meta = {
  title: "Components/QueryResult",
  parameters: {
    docs: {
      description: {
        component:
          "Wraps TanStack Query results with loading skeletons, refetch progress, stale errors, and empty states. Loaded content renders layout-neutral (no clipping frame), while loading/error chrome is applied only for those states. Pass `themeMode` from the host app (light/dark).",
      },
    },
  },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function mockQuery<T = string>(
  partial: Partial<UseQueryResult<T, Error>>,
): UseQueryResult<T, Error> {
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

export const Success: Story = {
  render: () => (
    <QueryResult
      themeMode="light"
      query={mockQuery({
        data: "Loaded content",
        isPending: false,
      })}
    >
      {(d) => <p className={paragraphCss}>{d}</p>}
    </QueryResult>
  ),
}

export const Loading: Story = {
  render: () => (
    <QueryResult
      themeMode="light"
      loadingDelayMs={0}
      query={mockQuery({
        data: undefined,
        isPending: true,
      })}
    >
      {() => null}
    </QueryResult>
  ),
}

export const BlockingError: Story = {
  render: () => (
    <QueryResult
      themeMode="light"
      query={mockQuery({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("Request failed"),
      })}
    >
      {() => null}
    </QueryResult>
  ),
}

export const StaleError: Story = {
  render: () => (
    <QueryResult
      themeMode="light"
      query={mockQuery({
        data: "Stale content still visible",
        isPending: false,
        isError: true,
        error: new Error("Background refetch failed"),
      })}
    >
      {(d) => <p className={paragraphCss}>{d}</p>}
    </QueryResult>
  ),
}

export const Refreshing: Story = {
  render: () => (
    <QueryResult
      themeMode="light"
      query={mockQuery({
        data: "Content while refetching",
        isPending: false,
        isFetching: true,
        isRefetching: true,
      })}
    >
      {(d) => <p className={paragraphCss}>{d}</p>}
    </QueryResult>
  ),
}

export const EmptyFallback: Story = {
  render: () => (
    <QueryResult<string[]>
      themeMode="light"
      query={mockQuery<string[]>({
        data: [],
        isPending: false,
      })}
      emptyFallback={<p className={paragraphCss}>No rows yet.</p>}
    >
      {(items) => <p className={paragraphCss}>{items.join(",")}</p>}
    </QueryResult>
  ),
}

export const SuccessDark: Story = {
  render: () => (
    <QueryResult
      themeMode="dark"
      query={mockQuery({
        data: "Loaded in dark theme",
        isPending: false,
      })}
    >
      {(d) => <p className={paragraphCss}>{d}</p>}
    </QueryResult>
  ),
}

const fullWidthRowsCss = css`
  width: 100%;
  border-top: 1px solid var(--color-gray-200);
`

const fullWidthRowCss = css`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-gray-200);
`

export const FullWidthRows: Story = {
  render: () => (
    <QueryResult
      themeMode="light"
      query={mockQuery({
        data: [
          { label: "Teacher Example", value: "teacher@example.com" },
          { label: "Assistant Example", value: "assistant@example.com" },
        ],
        isPending: false,
      })}
    >
      {(rows) => (
        <div className={fullWidthRowsCss}>
          {rows.map((row) => (
            <div key={row.value} className={fullWidthRowCss}>
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </QueryResult>
  ),
}
