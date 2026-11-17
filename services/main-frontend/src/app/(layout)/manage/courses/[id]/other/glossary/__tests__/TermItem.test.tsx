"use client"

import { act, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"

import TermItem from "../TermItem"

const mockConfirm = jest.fn()
const mockDelete = jest.fn()
const mockDeleteCallbacks: { onSuccess?: (() => void) | undefined } = {}

jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  deleteGlossaryTermMutation: () => ({}),
  updateGlossaryTermMutation: () => ({}),
}))

jest.mock("@/shared-module/common/hooks/useToastMutationOptions", () => ({
  __esModule: true,
  default: (
    _options: unknown,
    notification: { method: string },
    callbacks?: { onSuccess?: () => void },
  ) => {
    if (notification.method === "DELETE") {
      mockDeleteCallbacks.onSuccess = callbacks?.onSuccess
    }
    return {
      mutate: notification.method === "DELETE" ? mockDelete : jest.fn(),
      isPending: false,
    }
  },
}))

jest.mock("@/shared-module/components", () => ({
  ...jest.requireActual("@/shared-module/components"),
  useDialog: () => ({ confirm: mockConfirm }),
}))

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { term?: string; name?: string }) =>
      o?.term || o?.name ? `${key} ${o.term ?? o.name}` : key,
  }),
}))

const term = { id: "t1", term: "Algorithm", definition: "A recipe", course_id: "c1" }

function Harness({ onBeforeDelete }: { onBeforeDelete?: (id: string) => void }) {
  const [editing, setEditing] = useState(false)
  return (
    <ul>
      <TermItem
        term={term as never}
        isEditing={editing}
        onEdit={() => setEditing(true)}
        onCancel={() => setEditing(false)}
        refetch={() => {}}
        {...(onBeforeDelete ? { onBeforeDelete } : {})}
      />
    </ul>
  )
}

describe("TermItem", () => {
  beforeEach(() => {
    mockConfirm.mockReset()
    mockDelete.mockReset()
  })

  it("names Edit and Delete after the term", () => {
    render(<Harness />)
    expect(screen.getByRole("button", { name: "edit-term-named Algorithm" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "delete-term-named Algorithm" })).toBeTruthy()
  })

  it("focuses the first field on Edit and returns focus to Edit on Cancel", async () => {
    render(<Harness />)
    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: "edit-term-named Algorithm" }))
      return Promise.resolve()
    })
    expect(document.activeElement?.getAttribute("name") ?? "").toBe("updatedTerm")
    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: "button-text-cancel" }))
      return Promise.resolve()
    })
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "edit-term-named Algorithm" }),
    )
  })

  it("asks before deleting and deletes nothing when declined", async () => {
    mockConfirm.mockResolvedValue(false)
    render(<Harness />)
    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: "delete-term-named Algorithm" }))
      return Promise.resolve()
    })
    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("deletes once confirmed", async () => {
    mockConfirm.mockResolvedValue(true)
    const onBeforeDelete = jest.fn()
    render(<Harness onBeforeDelete={onBeforeDelete} />)
    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: "delete-term-named Algorithm" }))
      return Promise.resolve()
    })
    expect(mockDelete).toHaveBeenCalledWith({ path: { term_id: "t1" } })
    // Focus bookkeeping waits for the delete to succeed.
    expect(onBeforeDelete).not.toHaveBeenCalled()
    act(() => mockDeleteCallbacks.onSuccess?.())
    expect(onBeforeDelete).toHaveBeenCalledWith("term-heading-t1")
  })
})
