"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { PermissionPage } from "../PermissionPage"

const mockAdd = jest.fn()

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  getRolesOptions: () => ({
    queryKey: ["roles"],
    queryFn: () =>
      Promise.resolve([
        {
          user_id: "u1",
          email: "elsa@example.com",
          first_name: "Elsa",
          last_name: "Partanen",
          role: "Teacher",
        },
        {
          user_id: "u2",
          email: "eero@example.com",
          first_name: "",
          last_name: "",
          role: "Teacher",
        },
      ]),
  }),
  getPendingRolesOptions: () => ({ queryKey: ["pending"], queryFn: () => Promise.resolve([]) }),
  addRoleMutation: () => ({ mutationFn: mockAdd }),
  removeRoleMutation: () => ({ mutationFn: jest.fn() }),
}))

jest.mock("@/generated/api/sdk.generated", () => ({ addRole: jest.fn(), removeRole: jest.fn() }))

jest.mock("@/shared-module/common/utils/withSuspenseBoundary", () => ({
  __esModule: true,
  default: <T,>(component: T) => component,
}))

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { name?: string; email?: string }) =>
      o?.name ? `${key} ${o.name}` : o?.email ? `${key} ${o.email}` : key,
  }),
}))

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PermissionPage domain={{ tag: "Global" }} />
    </QueryClientProvider>,
  )

describe("PermissionPage", () => {
  beforeEach(() => mockAdd.mockReset())

  it("names the row actions after the person", async () => {
    renderPage()
    expect(await screen.findByRole("button", { name: "edit-role-for Elsa Partanen" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "remove-role-for eero@example.com" })).toBeTruthy()
  })

  it("rejects an invalid email with an inline error and adds nothing", async () => {
    renderPage()
    const input = await screen.findByRole("textbox", { name: /label-email/ })
    fireEvent.change(input, { target: { value: "notanemail" } })
    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: "label-add-user" }))
      return Promise.resolve()
    })
    await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"))
    expect(screen.getByText("enter-a-valid-email")).toBeTruthy()
    expect(mockAdd).not.toHaveBeenCalled()
  })
})
