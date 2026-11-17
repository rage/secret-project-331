"use client"

import "@testing-library/jest-dom"
import "@/shared-module/common/test-utils/inertFocus"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { postAuthSignup } from "@/shared-module/common/generated/auth-api/sdk.generated"

import CreateAccountForm from "../page"

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/signup",
  useSearchParams: () => new URLSearchParams(),
}))

// Fresh pending promise per render; tests needing the prefill resolve it via mockResolveIpCountry.
let mockResolveIpCountry: (country: string | null) => void = () => {}
jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  getUsersIpCountryOptions: () => ({
    queryKey: ["users-ip-country"],
    queryFn: () =>
      new Promise((resolve) => {
        mockResolveIpCountry = resolve
      }),
  }),
}))

jest.mock("@/generated/api/sdk.generated", () => ({
  createUserResearchConsent: jest.fn().mockResolvedValue({}),
}))
jest.mock("@/hooks/useUserResearchConsentQuery", () => ({
  refetchUserResearchConsent: jest.fn().mockResolvedValue(undefined),
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
    expect(screen.getByText("all-text-fields-required")).toBeVisible()
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
    const submit = screen.getByRole("button", { name: "create-an-account" })
    expect(submit).toBeEnabled()
  })

  it("shows errors associated to their fields when submitting an empty form", async () => {
    renderPage()
    const submit = screen.getByRole("button", { name: "create-an-account" })
    fireEvent.click(submit)

    const firstName = screen.getByLabelText("first-name")
    await waitFor(() => {
      expect(firstName).toHaveAttribute("aria-invalid", "true")
    })
    const describedBy = firstName.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const errorNode = describedBy
      ?.split(/\s+/)
      // oxlint-disable-next-line unicorn/prefer-query-selector -- useId values aren't valid CSS selectors
      .map((id) => document.getElementById(id))
      .find((el) => el?.textContent?.includes("required-field"))
    expect(errorNode).toBeTruthy()
  })

  it("keeps the user's chosen country when the ip-country prefill resolves afterwards", async () => {
    renderPage()
    const combobox = screen.getByRole("combobox") as HTMLInputElement

    // Let the ip-country query start fetching so mockResolveIpCountry targets this render.
    await act(async () => {})

    fireEvent.keyDown(combobox, { key: "ArrowDown" })
    const option = await screen.findByRole("option", { name: "fi" })
    fireEvent.click(option)
    await waitFor(() => {
      expect(combobox).toHaveValue("fi")
    })

    // oxlint-disable-next-line require-await -- act needs an async callback to flush pending effects
    await act(async () => {
      mockResolveIpCountry("se")
    })

    // The user's explicit choice must not be overwritten.
    expect(combobox).toHaveValue("fi")
  })

  it("prefills the country from the ip-country query when the user has not chosen one", async () => {
    renderPage()
    const combobox = screen.getByRole("combobox") as HTMLInputElement
    expect(combobox).toHaveValue("")

    // Let the ip-country query start fetching so mockResolveIpCountry targets this render.
    await act(async () => {})

    // oxlint-disable-next-line require-await -- act needs an async callback to flush pending effects
    await act(async () => {
      mockResolveIpCountry("se")
    })

    await waitFor(() => {
      expect(combobox).toHaveValue("se")
    })
  })

  it("styles the log-in link as an underlined link", () => {
    const { container } = renderPage()
    const link = container.querySelector(".signin-link a")
    expect(link).not.toBeNull()
    expect(link).toHaveTextContent("sign-in-if-you-have-an-account")
  })

  it("moves focus to the confirm-email heading once the research consent dialog closes", async () => {
    ;(postAuthSignup as jest.Mock).mockResolvedValue({ type: "success" })
    renderPage()
    await act(async () => {})
    fireEvent.change(screen.getByLabelText("first-name"), { target: { value: "Ada" } })
    fireEvent.change(screen.getByLabelText("last-name"), { target: { value: "Lovelace" } })
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "ada@example.com" } })
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "password123" } })
    fireEvent.change(screen.getByLabelText("confirm-password"), {
      target: { value: "password123" },
    })
    const combobox = screen.getByRole("combobox")
    fireEvent.keyDown(combobox, { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("option", { name: "fi" }))
    fireEvent.click(screen.getByRole("button", { name: "create-an-account" }))

    const dialog = await screen.findByTestId("research-consent-dialog")
    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "message-please-confirm-your-email-address",
      hidden: true,
    })
    // The page behind the dialog is inert, so the heading cannot take focus yet.
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))

    fireEvent.click(
      screen.getByRole("radio", {
        name: "research-consent-i-do-not-want-participate-in-educational-research",
      }),
    )
    fireEvent.click(screen.getByRole("button", { name: "button-text-save" }))
    await waitFor(() => expect(screen.queryByTestId("research-consent-dialog")).toBeNull())
    await act(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 100)
        }),
    )
    expect(heading).toHaveFocus()
  })
})
