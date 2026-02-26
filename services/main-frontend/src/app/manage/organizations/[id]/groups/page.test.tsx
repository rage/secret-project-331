"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import OrganizationGroupsPage from "./page"

import { manageOrganizationGroupRoute } from "@/shared-module/common/utils/routes"

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "org-123" }),
}))

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

jest.mock("@/services/backend/organizations", () => ({
  fetchOrganization: jest.fn(),
}))

jest.mock("@/services/backend/groups", () => ({
  createOrganizationGroup: jest.fn(),
  fetchOrganizationGroups: jest.fn(),
}))

jest.mock("@/shared-module/common/components/ErrorBanner", () => ({
  __esModule: true,
  default: ({ error }: { error: unknown }) => <div data-testid="error-banner">{String(error)}</div>,
}))

jest.mock("@/shared-module/common/components/Spinner", () => ({
  __esModule: true,
  default: () => <div data-testid="spinner" />,
}))

jest.mock("@/shared-module/common/components/Button", () => ({
  __esModule: true,
  default: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

jest.mock("@/shared-module/common/contexts/LoginStateContext", () => ({
  withSignedIn: (Component: React.ComponentType<unknown>) => Component,
}))

jest.mock("@/shared-module/common/hooks/useToastMutation", () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock("@/shared-module/common/utils/withErrorBoundary", () => ({
  __esModule: true,
  default: (Component: React.ComponentType<unknown>) => Component,
}))

const { useQuery } = jest.requireMock("@tanstack/react-query") as {
  useQuery: jest.Mock
}

const useToastMutationMock = jest.requireMock("@/shared-module/common/hooks/useToastMutation")
  .default as jest.Mock

const successQuery = <T,>(data: T) => ({
  isLoading: false,
  isError: false,
  isSuccess: true,
  data,
  error: null,
  refetch: jest.fn(),
})

describe("Organization groups list page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders groups and allows creating a group", () => {
    const createMutate = jest.fn()
    useToastMutationMock.mockReturnValue({ mutate: createMutate })

    useQuery.mockImplementation(({ queryKey }: { queryKey: [string, ...unknown[]] }) => {
      switch (queryKey[0]) {
        case "organization":
          return successQuery({ id: "org-123", name: "My Org" })
        case "organization-groups":
          return successQuery({
            can_create_groups: true,
            groups: [
              {
                id: "group-1",
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
                deleted_at: null,
                organization_id: "org-123",
                name: "Alpha Team",
              },
            ],
          })
        default:
          throw new Error(`Unexpected query key: ${String(queryKey[0])}`)
      }
    })

    render(<OrganizationGroupsPage />)

    expect(screen.getByText("Alpha Team")).toBeInTheDocument()
    const groupLink = screen.getByRole("link", { name: /Alpha Team/ })
    expect(groupLink).toHaveAttribute("href", manageOrganizationGroupRoute("org-123", "group-1"))

    const input = screen.getByLabelText("group-name")
    fireEvent.change(input, { target: { value: "New group" } })
    fireEvent.click(screen.getByRole("button", { name: "create-group" }))

    expect(createMutate).toHaveBeenCalledTimes(1)
  })

  it("shows membership-only note for non-admins", () => {
    useToastMutationMock.mockReturnValue({ mutate: jest.fn() })

    useQuery.mockImplementation(({ queryKey }: { queryKey: [string, ...unknown[]] }) => {
      switch (queryKey[0]) {
        case "organization":
          return successQuery({ id: "org-123", name: "My Org" })
        case "organization-groups":
          return successQuery({
            can_create_groups: false,
            groups: [],
          })
        default:
          throw new Error(`Unexpected query key: ${String(queryKey[0])}`)
      }
    })

    render(<OrganizationGroupsPage />)

    expect(screen.getByText("group-list-membership-only-note")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "create-group" })).not.toBeInTheDocument()
  })
})
