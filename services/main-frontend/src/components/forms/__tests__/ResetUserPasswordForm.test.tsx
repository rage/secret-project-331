"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"

import { resetUserPassword } from "@/generated/api/sdk.generated"

import ResetUserPasswordForm from "../ResetUserPasswordForm"

jest.mock("@/generated/api/sdk.generated", () => ({ resetUserPassword: jest.fn() }))

const mockReset = resetUserPassword as jest.Mock

function renderAndSubmit() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ResetUserPasswordForm token="token" />
    </QueryClientProvider>,
  )
  fireEvent.change(screen.getByLabelText("new-password"), { target: { value: "new-password-1" } })
  fireEvent.change(screen.getByLabelText("confirm-new-password"), {
    target: { value: "new-password-1" },
  })
  fireEvent.click(screen.getByRole("button", { name: "change-password" }))
}

describe("ResetUserPasswordForm", () => {
  beforeEach(() => mockReset.mockReset())

  it("shows the hint under the new password field", () => {
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResetUserPasswordForm token="token" />
      </QueryClientProvider>,
    )
    expect(screen.getByLabelText("new-password")).toHaveAccessibleDescription(
      "password-reset-new-password-hint",
    )
  })

  it("confirms the change when the API accepts the token", async () => {
    mockReset.mockResolvedValue(true)
    renderAndSubmit()
    expect(
      await screen.findByRole("heading", { level: 1, name: "password-changed-title" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "login" })).toHaveAttribute(
      "href",
      "/login?return_to=%2F",
    )
  })

  it("shows the broken-link state when the token stopped working before submit", async () => {
    mockReset.mockResolvedValue(false)
    renderAndSubmit()
    expect(
      await screen.findByRole("heading", { level: 1, name: "reset-link-invalid-title" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "password-changed-title" })).toBeNull()
  })
})
