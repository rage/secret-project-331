"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import HistoryList from "../HistoryList"

const revision = (id: string) => ({
  id,
  title: "Page",
  content: [],
  created_at: "2026-01-01T10:00:00.000Z",
  history_change_reason: "PageSaved",
  restored_from_id: null,
  author_user_id: "user-1",
  agent_client_name: null,
})

let currentId = "rev-1"
const mockRestore = jest.fn().mockImplementation(() => {
  currentId = "rev-2"
  return Promise.resolve("rev-2")
})

jest.mock("@/generated/api/sdk.generated", () => ({
  getPageHistoryCount: () => Promise.resolve(2),
  getPageHistory: () => Promise.resolve([revision(currentId)]),
  restorePageHistory: (...args: unknown[]) => mockRestore(...args),
}))

jest.mock("@/shared-module/common/hooks/usePaginationInfo", () => ({
  __esModule: true,
  default: () => ({ page: 1, setPage: jest.fn() }),
}))

describe("HistoryList", () => {
  it("names the revision on Compare and Restore", async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <HistoryList
          pageId="page-1"
          initialSelectedRevisionId="rev-1"
          onRestore={jest.fn().mockResolvedValue(undefined)}
          onCompare={jest.fn()}
        />
      </QueryClientProvider>,
    )

    expect(
      await screen.findByRole("button", { name: "compare-revision-named" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "restore-revision-named" })).toBeInTheDocument()
  })

  it("announces the restore in a status region and keeps focus on a Restore button", async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <HistoryList
          pageId="page-1"
          initialSelectedRevisionId="rev-1"
          onRestore={jest.fn().mockResolvedValue(undefined)}
          onCompare={jest.fn()}
        />
      </QueryClientProvider>,
    )

    const restoreButton = await screen.findByRole("button", { name: "restore-revision-named" })
    restoreButton.focus()
    fireEvent.click(restoreButton)

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("page-restored"))
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "restore-revision-named" }),
      ),
    )
  })
})
