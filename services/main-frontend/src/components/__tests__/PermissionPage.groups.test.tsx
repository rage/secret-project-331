"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import React from "react"

import { PermissionPage } from "../PermissionPage"

import { manageOrganizationGroupRoute } from "@/shared-module/common/utils/routes"

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}))

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

jest.mock("@vectopus/atlas-icons-react", () => ({
  CheckCircle: () => <span data-testid="icon-check" />,
  Pencil: () => <span data-testid="icon-pencil" />,
  XmarkCircle: () => <span data-testid="icon-x" />,
}))

jest.mock("../../services/backend/pendingRoles", () => ({
  fetchPendingRoles: jest.fn(),
}))

jest.mock("../../services/backend/roles", () => ({
  fetchRoles: jest.fn(),
  giveRole: jest.fn(),
  removeRole: jest.fn(),
}))

jest.mock("../../services/backend/groups", () => ({
  fetchGroupsWithAccessForDomain: jest.fn(),
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

jest.mock("@/shared-module/common/components/InputFields/TextField", () => ({
  __esModule: true,
  default: ({
    id,
    label,
    onChangeByValue,
  }: {
    id: string
    label: string
    onChangeByValue?: (value: string) => void
  }) => (
    <label>
      {label}
      <input aria-label={id} onChange={(event) => onChangeByValue?.(event.target.value)} />
    </label>
  ),
}))

jest.mock("@/shared-module/common/components/InputFields/SelectField", () => ({
  __esModule: true,
  default: ({
    id,
    label,
    options,
    onChangeByValue,
    defaultValue,
  }: {
    id: string
    label?: string
    options: Array<{ value: string; label: string }>
    onChangeByValue?: (value: string) => void
    defaultValue?: string
  }) => (
    <label>
      {label ?? id}
      <select
        aria-label={id}
        defaultValue={defaultValue}
        onChange={(event) => onChangeByValue?.(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}))

jest.mock("@/shared-module/common/hooks/useToastMutation", () => ({
  __esModule: true,
  default: () => ({
    mutate: jest.fn(),
  }),
}))

jest.mock("@/shared-module/common/utils/withSuspenseBoundary", () => ({
  __esModule: true,
  default: (Component: React.ComponentType<unknown>) => Component,
}))

const { useQuery } = jest.requireMock("@tanstack/react-query") as {
  useQuery: jest.Mock
}

const successQuery = <T,>(data: T) => ({
  isLoading: false,
  isError: false,
  isSuccess: true,
  data,
  error: null,
  refetch: jest.fn(),
})

describe("PermissionPage group access section", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders groups with access before direct roles and links to the group page", () => {
    const orgId = "11111111-1111-1111-1111-111111111111"
    const groupId = "22222222-2222-2222-2222-222222222222"

    useQuery.mockImplementation(({ queryKey }: { queryKey: [string, ...unknown[]] }) => {
      switch (queryKey[0]) {
        case "roles":
          return successQuery([
            {
              user_id: "33333333-3333-3333-3333-333333333333",
              first_name: "Ada",
              last_name: "Lovelace",
              email: "ada@example.com",
              role: "Teacher",
            },
          ])
        case "pending-roles":
          return successQuery([
            {
              id: "44444444-4444-4444-4444-444444444444",
              user_email: "pending@example.com",
              role: "Assistant",
            },
          ])
        case "group-access":
          return successQuery([
            {
              group_id: groupId,
              organization_id: orgId,
              group_name: "Teaching Team",
              role: "Assistant",
              member_count: 3,
            },
          ])
        default:
          throw new Error(`Unexpected query key: ${String(queryKey[0])}`)
      }
    })

    render(<PermissionPage domain={{ tag: "Organization", id: orgId }} />)

    const groupsHeading = screen.getByText("groups-with-access")
    const directRoleEmail = screen.getByText("ada@example.com")
    expect(
      groupsHeading.compareDocumentPosition(directRoleEmail) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const groupLink = screen.getByRole("link", { name: "Teaching Team" })
    expect(groupLink).toHaveAttribute("href", manageOrganizationGroupRoute(orgId, groupId))
  })
})
