"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import FeedbackList from "../FeedbackList"

const makeFeedback = (id: string, title: string) => ({
  id,
  blocks: [],
  course_id: "c1",
  created_at: "2024-01-02T10:00:00Z",
  feedback_given: `text ${id}`,
  marked_as_read: false,
  page_id: null,
  page_title: title,
  page_url_path: `/${id}`,
  user_id: null,
})

let items = [makeFeedback("a", "Page A"), makeFeedback("b", "Page B"), makeFeedback("c", "Page C")]

jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  getCourseFeedbackCountOptions: () => ({
    queryKey: ["count"],
    queryFn: () =>
      Promise.resolve({
        unread_feedback: items.length,
        read_feedback: 0,
        feedback_categories_counts: [],
      }),
  }),
  getCourseFeedbackOptions: () => ({
    queryKey: ["list"],
    queryFn: () => Promise.resolve([...items]),
  }),
  getCourseFeedbackCategoriesOptions: () => ({
    queryKey: ["cats"],
    queryFn: () => Promise.resolve([]),
  }),
  getCourseFeedbackCategoriesQueryKey: () => ["cats"],
  getCourseFeedbackCountQueryKey: () => ["count"],
  markFeedbackAsReadMutation: () => ({}),
}))

jest.mock("@/shared-module/common/hooks/useToastMutationOptions", () => ({
  __esModule: true,
  default: (_options: unknown, _toast: unknown, callbacks: { onSuccess: () => Promise<void> }) => ({
    mutate: ({ path }: { path: { feedback_id: string } }) => {
      items = items.filter((f) => f.id !== path.feedback_id)
      void callbacks.onSuccess()
    },
  }),
}))

jest.mock("@/hooks/usePageInfo", () => ({ usePageInfo: () => ({ data: undefined }) }))
jest.mock("@/hooks/useUserDetails", () => ({
  useBulkUserDetails: () => ({ data: undefined }),
  formatUserName: () => "",
  useUserName: () => "",
}))
jest.mock("@/hooks/useFeedbackCategoryToggleInfo", () => ({
  __esModule: true,
  default: () => ({
    allFeedbackId: "all",
    selectedCategory: { current: "all" },
    toggleState: {
      selectedKeys: new Set(["all"]),
      isSelected: () => true,
      toggleKey: () => {},
      setSelectedKeys: () => {},
      selectionMode: "single",
      disallowEmptySelection: true,
      isDisabled: false,
    },
  }),
}))
jest.mock("@/shared-module/common/hooks/usePaginationInfo", () => ({
  __esModule: true,
  default: () => ({ page: 1, limit: 10, setPage: () => {}, setLimit: () => {} }),
}))
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("FeedbackList", () => {
  beforeEach(() => {
    items = [makeFeedback("a", "Page A"), makeFeedback("b", "Page B"), makeFeedback("c", "Page C")]
  })

  it("moves focus to the next item heading after Mark as read", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FeedbackList courseId="c1" read={false} />
      </QueryClientProvider>,
    )
    const buttons = await screen.findAllByRole("button", { name: "button-mark-as-read" })
    await act(() => {
      fireEvent.click(buttons[0] as HTMLElement)
      return Promise.resolve()
    })
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain("Page B")
    })
    expect(document.activeElement?.tagName).toBe("H3")
  })
})
