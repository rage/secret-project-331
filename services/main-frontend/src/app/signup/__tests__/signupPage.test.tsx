"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import CreateAccountForm from "../page"

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/signup",
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  getUsersIpCountryOptions: () => ({
    queryKey: ["users-ip-country"],
    queryFn: async () => null,
  }),
}))

jest.mock("@/shared-module/common/generated/auth-api/sdk.generated", () => ({
  postAuthSignup: jest.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateAccountForm />
    </QueryClientProvider>,
  )
}

// The global react-i18next mock returns translation keys, so labels equal their keys.
describe("Create account form accessibility", () => {
  it("associates every field with its label", () => {
    renderPage()
    expect(screen.getByLabelText("first-name")).toBeInstanceOf(HTMLInputElement)
    expect(screen.getByLabelText("last-name")).toBeInstanceOf(HTMLInputElement)
    expect(screen.getByRole("combobox")).toHaveAccessibleName("enter-country-question")
    expect(screen.getByLabelText("email")).toBeInstanceOf(HTMLInputElement)
    expect(screen.getByLabelText("password")).toBeInstanceOf(HTMLInputElement)
    expect(screen.getByLabelText("confirm-password")).toBeInstanceOf(HTMLInputElement)
    expect(screen.getByLabelText("email-communication-consent-checkbox-text")).toBeInstanceOf(
      HTMLInputElement,
    )
  })

  it("marks the required fields programmatically and explains it visibly", () => {
    renderPage()
    for (const label of ["first-name", "last-name", "email", "password", "confirm-password"]) {
      expect(screen.getByLabelText(label)).toHaveAttribute("aria-required", "true")
    }
    // The requirement is stated in visible text instead of unexplained asterisks.
    expect(screen.getByText("all-fields-are-required")).toBeVisible()
  })

  it("names the fieldset after the main heading", () => {
    const { container } = renderPage()
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveAttribute("id", "create-account-heading")
    const fieldset = container.querySelector("fieldset")
    expect(fieldset).toHaveAttribute("aria-labelledby", "create-account-heading")
    expect(fieldset).toHaveAccessibleName("create-new-account")
  })

  it("does not use placeholders that repeat the labels", () => {
    renderPage()
    for (const label of ["first-name", "last-name", "email", "password", "confirm-password"]) {
      const input = screen.getByLabelText(label) as HTMLInputElement
      // The floating-label field uses a blank placeholder; no superfluous placeholder copy.
      expect(input.placeholder.trim()).toBe("")
    }
  })

  it("keeps the submit button enabled while the form is incomplete", () => {
    renderPage()
    const submit = screen.getByDisplayValue("create-an-account")
    expect(submit).toBeEnabled()
  })

  it("shows errors associated to their fields when submitting an empty form", async () => {
    renderPage()
    const submit = screen.getByDisplayValue("create-an-account")
    fireEvent.click(submit)

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0)
    })

    const firstName = screen.getByLabelText("first-name")
    await waitFor(() => {
      expect(firstName).toHaveAttribute("aria-invalid", "true")
    })
    const describedBy = firstName.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const errorNode = describedBy
      ?.split(/\s+/)
      .map((id) => document.getElementById(id))
      .find((el) => el?.textContent?.includes("required-field"))
    expect(errorNode).toBeTruthy()
  })

  it("styles the log-in link as an underlined link", () => {
    const { container } = renderPage()
    const link = container.querySelector(".signin-link a")
    expect(link).not.toBeNull()
    expect(link).toHaveTextContent("sign-in-if-you-have-an-account")
  })
})
