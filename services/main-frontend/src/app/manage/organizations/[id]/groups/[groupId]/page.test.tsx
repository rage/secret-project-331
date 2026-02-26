"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"

import OrganizationGroupDetailPage from "./page"

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "org-123", groupId: "group-123" }),
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

jest.mock("@/constants/roles", () => ({
  USER_ROLES: [
    { value: "Assistant", translationKey: "role-assistant" },
    { value: "Teacher", translationKey: "role-teacher" },
  ],
}))

jest.mock("@/services/backend/groups", () => ({
  addGroupMember: jest.fn(),
  addGroupRole: jest.fn(),
  deleteGroup: jest.fn(),
  fetchGroup: jest.fn(),
  fetchGroupMembers: jest.fn(),
  fetchGroupRoles: jest.fn(),
  removeGroupMember: jest.fn(),
  removeGroupRole: jest.fn(),
  renameGroup: jest.fn(),
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

jest.mock("@/shared-module/common/components/ErrorBanner", () => ({
  __esModule: true,
  default: ({ error }: { error: unknown }) => <div data-testid="error-banner">{String(error)}</div>,
}))

jest.mock("@/shared-module/common/components/Spinner", () => ({
  __esModule: true,
  default: () => <div data-testid="spinner" />,
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

describe("Organization group detail page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders members and role assignments and uses organization scope when adding a group role", async () => {
    const mutationFns = Array.from({ length: 6 }, () => jest.fn())
    let mutationIndex = 0
    useToastMutationMock.mockImplementation(() => ({
      mutate: mutationFns[mutationIndex++ % mutationFns.length],
    }))

    useQuery.mockImplementation(({ queryKey }: { queryKey: [string, ...unknown[]] }) => {
      switch (queryKey[0]) {
        case "group-detail":
          return successQuery({
            group: {
              id: "group-123",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
              deleted_at: null,
              organization_id: "org-123",
              name: "Teaching Team",
            },
            capabilities: {
              is_member: true,
              can_manage_group: true,
              can_manage_members: true,
              can_manage_group_roles: true,
            },
          })
        case "group-members":
          return successQuery([
            {
              user_id: "user-1",
              first_name: "Ada",
              last_name: "Lovelace",
              email: "ada@example.com",
            },
          ])
        case "group-roles":
          return successQuery([
            {
              id: "role-1",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
              deleted_at: null,
              group_id: "group-123",
              role: "Assistant",
              organization_id: "org-123",
              course_id: null,
              course_instance_id: null,
              exam_id: null,
            },
          ])
        default:
          throw new Error(`Unexpected query key: ${String(queryKey[0])}`)
      }
    })

    render(<OrganizationGroupDetailPage />)

    expect(screen.getByText("Teaching Team")).toBeInTheDocument()
    expect(screen.getByText("ada@example.com")).toBeInTheDocument()
    expect(screen.getByText("group-role-assignments")).toBeInTheDocument()
    expect(screen.getByText("Assistant")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByLabelText("group-name")).toHaveValue("Teaching Team")
    })

    fireEvent.click(screen.getByRole("button", { name: "add-group-role" }))
    expect(mutationFns[4]).toHaveBeenCalledWith({ tag: "Organization", id: "org-123" })
  })
})
