"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"

import type { DeviceVerificationInfo } from "@/generated/api/types.generated"

import DeviceVerificationPage from "../page"

jest.mock("react-i18next", () => {
  const en: Record<string, string> = jest.requireActual(
    "@/shared-module/common/locales/en/main-frontend.json",
  )
  const t = (key: string, options: Record<string, string> = {}) =>
    (en[key] ?? key).replaceAll(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options[name]))
  return { useTranslation: () => ({ t }) }
})

jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: jest.fn() }) }))

jest.mock("@/shared-module/common/contexts/LoginStateContext", () => ({
  withSignedIn: <T,>(Component: T) => Component,
}))

jest.mock("@/shared-module/common/hooks/usePageTitle", () => ({ usePageTitle: () => {} }))

jest.mock("@/shared-module/common/hooks/useQueryParameter", () => ({
  __esModule: true,
  default: () => "ABCD-1234",
}))

const mockVerificationInfo: DeviceVerificationInfo = {
  client_id: "tmc-vscode",
  client_name: "TestMyCode for VS Code",
  scopes: ["exercise-services"],
  user_code: "ABCD-1234",
}

jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  getOauthDeviceVerificationOptions: () => ({
    queryKey: ["oauth-device-verification"],
    queryFn: () => Promise.resolve(mockVerificationInfo),
  }),
}))

jest.mock("@/generated/api/sdk.generated", () => ({
  approveOauthDeviceVerification: jest.fn(),
  denyOauthDeviceVerification: jest.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DeviceVerificationPage />
    </QueryClientProvider>,
  )
}

describe("OAuth device verification page", () => {
  it("shows the user code and names the client before the decision buttons", async () => {
    renderPage()

    expect(await screen.findByTestId("oauth-device-user-code")).toHaveTextContent("ABCD-1234")
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "TestMyCode for VS Code wants to access your account",
    )
    expect(
      screen.getByText("Approve only if this code matches the one shown in your editor:"),
    ).toBeVisible()
    expect(screen.getByTestId("oauth-device-approve-button")).toBeEnabled()
  })
})
