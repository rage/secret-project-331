"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import type { Chapter } from "@/generated/api/types.generated"

import NewChapterForm from "../NewChapterForm"

const mockCreateChapter = jest.fn().mockResolvedValue({})
const mockUpdateChapter = jest.fn().mockResolvedValue({})

jest.mock("@/generated/api/sdk.generated", () => ({
  createChapter: (...args: unknown[]) => mockCreateChapter(...args),
  updateChapter: (...args: unknown[]) => mockUpdateChapter(...args),
}))

const FROZEN_NOW = new Date(2026, 0, 15, 10, 30, 0)

/** Opens the calendar for a DateTimeLocalField group and clicks "Now" to commit the current time. */
function pickNow(groupName: string) {
  const group = screen.getByRole("group", { name: groupName })
  fireEvent.click(within(group).getByRole("button"))
  fireEvent.click(screen.getByRole("button", { name: "datePicker.now" }))
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
}

/** Waits for react-hook-form's async `mode: "onChange"` validation to enable the button first;
 *  clicking while it's still disabled (mid-validation) would be a silent no-op. */
async function clickSubmit(buttonName: string) {
  const button = screen.getByRole("button", { name: buttonName })
  await waitFor(() => expect(button).not.toBeDisabled())
  fireEvent.click(button)
}

function renderForm(props: Partial<React.ComponentProps<typeof NewChapterForm>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSubmitForm = jest.fn()
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <NewChapterForm
        courseId="course-1"
        onSubmitForm={onSubmitForm}
        chapterNumber={1}
        initialData={null}
        newRecord={true}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { ...utils, onSubmitForm }
}

describe("NewChapterForm", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FROZEN_NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it("submits opens_at and deadline as full ISO strings when their checkboxes are checked", async () => {
    renderForm()

    fireEvent.change(document.querySelector('input[name="name"]') as HTMLInputElement, {
      target: { value: "Chapter 1" },
    })
    fireEvent.click(document.querySelector('input[name="has_opens_at"]') as HTMLInputElement)
    pickNow("label-opens-at")
    fireEvent.click(document.querySelector('input[name="has_deadline"]') as HTMLInputElement)
    pickNow("label-deadline")

    await clickSubmit("button-text-create")

    await waitFor(() => expect(mockCreateChapter).toHaveBeenCalledTimes(1))
    const body = mockCreateChapter.mock.calls[0][0].body
    expect(body.opens_at).toBe(FROZEN_NOW.toISOString())
    expect(body.deadline).toBe(FROZEN_NOW.toISOString())
    expect(body.color).toBeNull()
  })

  it("submits null for opens_at, deadline and color when left unchecked", async () => {
    renderForm()

    fireEvent.change(document.querySelector('input[name="name"]') as HTMLInputElement, {
      target: { value: "Chapter 1" },
    })
    await clickSubmit("button-text-create")

    await waitFor(() => expect(mockCreateChapter).toHaveBeenCalledTimes(1))
    const body = mockCreateChapter.mock.calls[0][0].body
    expect(body.opens_at).toBeNull()
    expect(body.deadline).toBeNull()
    expect(body.color).toBeNull()
  })

  it("preserves an existing opens_at when editing without touching the field", async () => {
    const initialData: Chapter = {
      id: "chapter-1",
      course_id: "course-1",
      course_module_id: "module-1",
      chapter_number: 1,
      name: "Chapter 1",
      created_at: "2020-01-01T00:00:00.000Z",
      updated_at: "2020-01-01T00:00:00.000Z",
      opens_at: "2025-06-01T08:15:00.000Z",
    }
    renderForm({ initialData, newRecord: false })

    await clickSubmit("button-text-update")

    await waitFor(() => expect(mockUpdateChapter).toHaveBeenCalledTimes(1))
    const body = mockUpdateChapter.mock.calls[0][0].body
    expect(new Date(body.opens_at).toISOString()).toBe(
      new Date(initialData.opens_at!).toISOString(),
    )
  })
})
