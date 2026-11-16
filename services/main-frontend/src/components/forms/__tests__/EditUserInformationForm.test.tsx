"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import EditUserInformationForm from "../EditUserInformationForm"

jest.mock("@/generated/api/sdk.generated", () => ({ updateUserInfo: jest.fn() }))
jest.mock("@/components/EmailVerificationSection", () => ({
  refetchEmailVerificationStatusForUser: jest.fn(),
}))
jest.mock("@/hooks/useUserDetailsForUserQuery", () => ({ refetchUserDetailsForUser: jest.fn() }))

function renderForm() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <EditUserInformationForm
        email="ada@example.com"
        firstName="Ada"
        lastName="Lovelace"
        country="fi"
        emailCommunicationConsent={false}
      />
    </QueryClientProvider>,
  )
}

describe("EditUserInformationForm", () => {
  it("shows the profile as a description list under an h2", () => {
    const { container } = renderForm()
    expect(
      screen.getByRole("heading", { level: 2, name: "user-settings-personal-info" }),
    ).toBeTruthy()
    expect(container.querySelectorAll("dl dt").length).toBeGreaterThanOrEqual(5)
    const email = screen.getByTestId("personal-info-email-value")
    expect(email.tagName).toBe("DD")
    expect(email).toHaveTextContent("ada@example.com")
  })

  it("focuses the first field on edit and returns focus to Edit profile on cancel", async () => {
    renderForm()
    fireEvent.click(screen.getByTestId("edit-profile-button"))
    await waitFor(() => expect(screen.getByLabelText("email")).toHaveFocus())
    fireEvent.click(screen.getByRole("button", { name: "button-text-cancel" }))
    await waitFor(() => expect(screen.getByTestId("edit-profile-button")).toHaveFocus())
  })

  it("sets autocomplete tokens and an email input type", () => {
    renderForm()
    fireEvent.click(screen.getByTestId("edit-profile-button"))
    const email = screen.getByLabelText("email")
    expect(email).toHaveAttribute("type", "email")
    expect(email).toHaveAttribute("autocomplete", "email")
    expect(screen.getByLabelText("first-name")).toHaveAttribute("autocomplete", "given-name")
    expect(screen.getByLabelText("last-name")).toHaveAttribute("autocomplete", "family-name")
  })
})
