"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle, Pencil, XmarkCircle } from "@vectopus/atlas-icons-react"
import type { TFunction } from "i18next"
import { t as globalT } from "i18next"
import { useRouter, useSearchParams } from "next/navigation"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { Equals } from "tsafe"
import { assert } from "tsafe"

import { SORT_ASCENDING } from "@/components/credit-registration/constants"
import {
  addRoleMutation as addRoleMutationOptions,
  getPendingRolesOptions,
  getRolesOptions,
  removeRoleMutation as removeRoleMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  addRole as addRoleFromApi,
  removeRole as removeRoleFromApi,
} from "@/generated/api/sdk.generated"
import type { GetRolesData, RoleDomain, RoleUser, UserRole } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import {
  Button,
  ErrorNotice,
  QueryResult,
  Select,
  Table,
  TextField,
} from "@/shared-module/components"
import type { TableColumn } from "@/shared-module/components"

const iconButtonCss = css`
  cursor: pointer;
  background-color: transparent;
  border: 0;
  margin-right: 8px;
`

const SORT_KEY_NAME = "name"
const SORT_KEY_EMAIL = "email"
const SORT_KEY_ROLE = "role"
const ADMIN: UserRole = "Admin"
const ASSISTANT: UserRole = "Assistant"
const REVIEWER: UserRole = "Reviewer"
const TEACHER: UserRole = "Teacher"
const COURSE_OR_EXAM_CREATOR: UserRole = "CourseOrExamCreator"
const MATERIAL_VIEWER: UserRole = "MaterialViewer"
const TEACHING_AND_LEARNING_SERVICES: UserRole = "TeachingAndLearningServices"
const STATS_VIEWER: UserRole = "StatsViewer"
const CREDIT_REGISTRATION_ADMIN: UserRole = "CreditRegistrationAdmin"

const options = (t: TFunction) => {
  return [
    { value: ADMIN, label: t("role-admin") },
    { value: ASSISTANT, label: t("role-assistant") },
    { value: REVIEWER, label: t("role-reviewer") },
    { value: TEACHER, label: t("role-teacher") },
    {
      value: COURSE_OR_EXAM_CREATOR,
      label: t("role-course-or-exam-creator"),
    },
    {
      value: MATERIAL_VIEWER,
      label: t("role-material-viewer"),
    },
    {
      value: TEACHING_AND_LEARNING_SERVICES,
      label: t("role-teaching-and-learning-services"),
    },
    {
      value: STATS_VIEWER,
      label: t("role-stats-viewer"),
    },
    {
      value: CREDIT_REGISTRATION_ADMIN,
      label: t("role-credit-registration-admin"),
    },
  ]
}

// Check we have options for all the roles in the system
const _allRoles = options(globalT).map((o) => o.value)
type rolesInTheForm = (typeof _allRoles)[number]
// Check if two string unions are the same. If this fails, you have changed the UserRole type and need to update the options function above.
assert<Equals<rolesInTheForm, UserRole>>()

interface EditingRole {
  userId: string
  currentRole: UserRole
}

interface Props {
  domain: RoleDomain
}

type RoleQuery = NonNullable<GetRolesData["query"]>

const PermissionPageComponent: React.FC<React.PropsWithChildren<Props>> = ({ domain }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  let sort_key = searchParams.get("sort")
  if (typeof sort_key !== "string") {
    sort_key = SORT_KEY_NAME
  }
  const [sorting, setSorting] = useState(sort_key)

  function sortRoles(first: RoleUser, second: RoleUser): number {
    if (sorting === SORT_KEY_NAME) {
      return 0 // first.name.localeCompare(second.name)
    } else if (sorting === SORT_KEY_EMAIL) {
      // Primary sort by role, secondary by email
      const roleComparison = first.role.localeCompare(second.role)
      return roleComparison !== 0 ? roleComparison : first.email.localeCompare(second.email)
    } else if (sorting === SORT_KEY_ROLE) {
      // Primary sort by email, secondary by role
      const emailComparison = first.email.localeCompare(second.email)
      return emailComparison !== 0 ? emailComparison : first.role.localeCompare(second.role)
    }
    return 0
  }

  let query: RoleQuery
  if (domain.tag === "Global") {
    query = { global: true }
  } else if (domain.tag === "Organization") {
    query = { organization_id: domain.id }
  } else if (domain.tag === "Course") {
    query = { course_id: domain.id }
  } else if (domain.tag === "CourseInstance") {
    query = { course_instance_id: domain.id }
  } else if (domain.tag === "Exam") {
    query = { exam_id: domain.id }
  } else {
    // oxlint-disable-next-line i18next/no-literal-string
    throw new Error("Unknown domain type")
  }

  const {
    control: addRoleControl,
    setValue: setAddRoleValue,
    getValues: getAddRoleValues,
  } = useForm<{ email: string; role: UserRole }>({
    defaultValues: { email: "", role: ASSISTANT },
  })
  const {
    control: editRoleControl,
    reset: resetEditRoleForm,
    getValues: getEditRoleValues,
  } = useForm<{ role: UserRole }>({ defaultValues: { role: ASSISTANT } })
  const [editingRole, setEditingRole] = useState<EditingRole | null>(null)
  const [mutationError, setMutationError] = useState<unknown | null>(null)
  const roleQuery = useQuery({
    ...getRolesOptions({
      query,
    }),
  })
  const pendingRolesQuery = useQuery({
    ...getPendingRolesOptions({
      query,
    }),
  })
  const addMutation = useToastMutationOptions(
    addRoleMutationOptions(),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        // oxlint-disable-next-line i18next/no-literal-string
        setAddRoleValue("email", "")
        roleQuery.refetch()
      },
      onError: setMutationError,
    },
  )
  const editMutation = useToastMutation(
    ({
      email,
      oldRole,
      newRole: nextRole,
    }: {
      email: string
      oldRole: UserRole
      newRole: UserRole
    }) =>
      removeRoleFromApi({
        body: { email, role: oldRole, domain },
      }).then(() =>
        addRoleFromApi({
          body: { email, role: nextRole, domain },
        }),
      ),
    { notify: true, method: "POST" },
    {
      onSuccess: () => roleQuery.refetch(),
      onError: setMutationError,
    },
  )
  const removeMutation = useToastMutationOptions(
    removeRoleMutationOptions(),
    { notify: true, method: "POST" },
    {
      onSuccess: () => roleQuery.refetch(),
      onError: setMutationError,
    },
  )

  const sortColumn = (key: string): Pick<TableColumn<RoleUser>, "onSort" | "sortDirection"> => ({
    onSort: () => {
      const params = new URLSearchParams(searchParams)
      // oxlint-disable-next-line i18next/no-literal-string -- query parameter name
      params.set("sort", key)
      router.replace(`?${params.toString()}`)
      setSorting(key)
    },
    sortDirection: sorting === key ? SORT_ASCENDING : null,
  })

  const isEditing = (ur: RoleUser) =>
    editingRole?.userId === ur.user_id && editingRole.currentRole === ur.role

  const columns: TableColumn<RoleUser>[] = [
    {
      header: t("text-field-label-name"),
      cell: (ur) => (ur.first_name ? `${ur.first_name} ${ur.last_name}` : ur.last_name),
      ...sortColumn(SORT_KEY_NAME),
    },
    { header: t("label-email"), cell: (ur) => ur.email, ...sortColumn(SORT_KEY_EMAIL) },
    {
      header: t("label-role"),
      cell: (ur) =>
        isEditing(ur) ? (
          <Select
            name="role"
            control={editRoleControl}
            id="edit-user-role"
            label={t("label-role")}
            options={options(t)}
          />
        ) : (
          ur.role
        ),
      ...sortColumn(SORT_KEY_ROLE),
    },
    {
      header: t("label-action"),
      cell: (ur) =>
        isEditing(ur) ? (
          <>
            <button
              aria-label={t("save-edited-role")}
              className={iconButtonCss}
              onClick={() => {
                editMutation.mutate({
                  email: ur.email,
                  oldRole: ur.role,
                  newRole: getEditRoleValues().role,
                })
                setEditingRole(null)
              }}
            >
              <CheckCircle />
            </button>
            <button
              aria-label={t("cancel-editing-role")}
              className={iconButtonCss}
              onClick={() => setEditingRole(null)}
            >
              <XmarkCircle />
            </button>
          </>
        ) : (
          <>
            <button
              aria-label={t("edit-role")}
              className={iconButtonCss}
              onClick={() => {
                setEditingRole({ userId: ur.user_id, currentRole: ur.role })
                resetEditRoleForm({ role: ur.role })
              }}
            >
              <Pencil size={20} color={"#1A2333"} />
            </button>
            <button
              aria-label={t("remove-role")}
              className={iconButtonCss}
              onClick={() =>
                removeMutation.mutate({ body: { email: ur.email, role: ur.role, domain } })
              }
            >
              <XmarkCircle size={20} color={"#1A2333"} />
            </button>
          </>
        ),
    },
  ]

  const userList = (
    <QueryResult query={roleQuery} emptyFallback={<div>{t("no-roles-found")}</div>}>
      {(roleData) => (
        <Table
          caption={t("link-permissions")}
          columns={columns}
          rows={roleData.toSorted(sortRoles)}
          rowKey={(ur) => ur.user_id + ur.role}
        />
      )}
    </QueryResult>
  )

  return (
    <>
      {/* notify:true already announces this error via the toast; the banner is just the persistent copy */}
      {mutationError && (
        // oxlint-disable-next-line i18next/no-literal-string -- "off" is an ErrorNoticeAnnouncement enum value, not UI text
        <ErrorNotice error={mutationError} announce="off" />
      )}
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--space-3);
          margin: var(--space-4) 0;
        `}
      >
        <div
          className={css`
            flex: 1 1 16rem;
            min-width: 0;
          `}
        >
          <TextField name="email" control={addRoleControl} label={t("label-email")} />
        </div>
        <div
          className={css`
            flex: 0 1 20rem;
            min-width: 12rem;
          `}
        >
          <Select
            name="role"
            control={addRoleControl}
            id="add-user-role"
            label={t("label-role")}
            options={options(t)}
          />
        </div>
        <Button
          onClick={() =>
            addMutation.mutate({
              body: {
                ...getAddRoleValues(),
                domain,
              },
            })
          }
          size="medium"
          variant="primary"
        >
          {t("label-add-user")}
        </Button>
      </div>

      {userList}
      {pendingRolesQuery.data && pendingRolesQuery.data.length > 0 && (
        <div
          className={css`
            margin-top: 2rem;
          `}
        >
          <h3>{t("title-pending-roles")}</h3>
          <ul>
            {pendingRolesQuery.data.map((pendingRole) => (
              <li key={pendingRole.id}>
                {pendingRole.user_email} ({pendingRole.role})
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

export const PermissionPage = withSuspenseBoundary(PermissionPageComponent)
