"use client"

import "@testing-library/jest-dom"
import "@/shared-module/common/test-utils/inertFocus"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"

import { DialogProvider, useFocusAfterRemoval } from "@/shared-module/components"

import TermItem from "../TermItem"

const mockDeleteCallbacks: { onSuccess?: (() => void) | undefined } = {}

jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  deleteGlossaryTermMutation: () => ({}),
  updateGlossaryTermMutation: () => ({}),
}))

// A delete that succeeds a moment after the request, like a network round trip.
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
      mutate: () => {
        setTimeout(() => mockDeleteCallbacks.onSuccess?.(), 20)
      },
      isPending: false,
    }
  },
}))

const terms = [
  { id: "t1", term: "Algorithm", definition: "A recipe", course_id: "c1" },
  { id: "t2", term: "Bit", definition: "Zero or one", course_id: "c1" },
]

function Glossary() {
  const [items, setItems] = useState(terms)
  const [removedId, setRemovedId] = useState<string | null>(null)
  const { containerRef, listHeadingRef, remember } = useFocusAfterRemoval<HTMLUListElement>(items)
  return (
    <>
      <h1 ref={listHeadingRef} tabIndex={-1}>
        Glossary
      </h1>
      <ul ref={containerRef}>
        {items.map((term) => (
          <TermItem
            key={term.id}
            term={term as never}
            isEditing={false}
            onEdit={() => {}}
            onCancel={() => {}}
            onBeforeDelete={(headingId) => {
              remember(headingId)
              setRemovedId(term.id)
            }}
            refetch={() => setItems((current) => current.filter((t) => t.id !== removedId))}
          />
        ))}
      </ul>
    </>
  )
}

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("glossary Delete with the real confirm dialog", () => {
  it("moves focus to the next term once the confirm has closed", async () => {
    render(
      <DialogProvider>
        <Glossary />
      </DialogProvider>,
    )
    const [firstDelete] = screen.getAllByRole("button", { name: /delete-term-named/ })
    fireEvent.click(firstDelete as HTMLElement)
    const dialog = await screen.findByRole("alertdialog")
    fireEvent.click(screen.getByRole("button", { name: "button-text-delete" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await act(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 150)
        }),
    )
    expect(dialog).not.toBeInTheDocument()
    expect(document.activeElement).toBe(document.querySelector('[id="term-heading-t2"]'))
  })
})
