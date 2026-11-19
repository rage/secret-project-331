"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { changeUserPassword } from "@/generated/api/sdk.generated"

import ChangeUserPasswordForm from "../ChangeUserPasswordForm"

jest.mock("@/generated/api/sdk.generated", () => ({ changeUserPassword: jest.fn() }))

const mockChange = changeUserPassword as jest.Mock

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ChangeUserPasswordForm />
    </QueryClientProvider>,
  )
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("old-password"), { target: { value: "wrong-old" } })
  fireEvent.change(screen.getByLabelText("new-password"), { target: { value: "new-password-1" } })
  fireEvent.change(screen.getByLabelText("confirm-new-password"), {
    target: { value: "new-password-1" },
  })
  fireEvent.click(screen.getByRole("button", { name: "button-text-save" }))
}

describe("ChangeUserPasswordForm", () => {
  beforeEach(() => mockChange.mockReset())

  it("focuses the current password on open and returns focus to the button on cancel", async () => {
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: "change-password" }))
    await waitFor(() => expect(screen.getByLabelText("old-password")).toHaveFocus())
    fireEvent.click(screen.getByRole("button", { name: "button-text-cancel" }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "change-password" })).toHaveFocus(),
    )
  })

  it("sets autocomplete tokens", () => {
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: "change-password" }))
    expect(screen.getByLabelText("old-password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    )
    expect(screen.getByLabelText("new-password")).toHaveAttribute("autocomplete", "new-password")
  })

  it("shows an error and keeps the form open when the old password is wrong", async () => {
    mockChange.mockResolvedValue(false)
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: "change-password" }))
    fillAndSubmit()

    const current = screen.getByLabelText("old-password")
    await waitFor(() => expect(current).toHaveAttribute("aria-invalid", "true"))
    expect(screen.getByText("current-password-incorrect")).toBeInTheDocument()
    expect(current).toHaveFocus()
    expect(screen.queryByRole("button", { name: "change-password" })).toBeNull()
  })

  it("closes the form and returns focus after a successful change", async () => {
    mockChange.mockResolvedValue(true)
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: "change-password" }))
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "change-password" })).toHaveFocus(),
    )
  })
})
