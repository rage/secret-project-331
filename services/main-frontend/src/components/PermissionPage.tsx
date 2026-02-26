"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle, Pencil, XmarkCircle } from "@vectopus/atlas-icons-react"
import { t as globalT, TFunction } from "i18next"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { assert, Equals } from "tsafe"

import { fetchGroupsWithAccessForDomain } from "../services/backend/groups"
import { fetchPendingRoles } from "../services/backend/pendingRoles"
import { fetchRoles, giveRole, removeRole } from "../services/backend/roles"
import CaretArrowDown from "../shared-module/common/img/caret-arrow-down.svg"

import {
  GroupAccessRow,
  RoleDomain,
  RoleQuery,
  RoleUser,
  UserRole,
} from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { manageOrganizationGroupRoute } from "@/shared-module/common/utils/routes"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
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
  newRole: UserRole
}

interface Props {
  domain: RoleDomain
}

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
  if (domain.tag == "Global") {
    query = { global: true }
  } else if (domain.tag == "Organization") {
    query = { organization_id: domain.id }
  } else if (domain.tag == "Course") {
    query = { course_id: domain.id }
  } else if (domain.tag == "CourseInstance") {
    query = { course_instance_id: domain.id }
  } else if (domain.tag == "Exam") {
    query = { exam_id: domain.id }
  } else {
    // eslint-disable-next-line i18next/no-literal-string
    throw "Unknown domain type"
  }

  const [newEmail, setNewEmail] = useState("")
  // eslint-disable-next-line i18next/no-literal-string
  const [newRole, setNewRole] = useState<UserRole>("Assistant")
  const [editingRole, setEditingRole] = useState<EditingRole | null>(null)
  const [mutationError, setMutationError] = useState<unknown | null>(null)
  const roleQuery = useQuery({
    queryKey: [`roles`, domain, query],
    queryFn: () => fetchRoles(query),
  })
  const pendingRolesQuery = useQuery({
    queryKey: [`pending-roles`, domain, query],
    queryFn: () => fetchPendingRoles(query),
  })
  const groupAccessQuery = useQuery({
    queryKey: [`group-access`, domain, query],
    queryFn: () => fetchGroupsWithAccessForDomain(query),
    enabled: domain.tag !== "Global",
  })
  const addMutation = useToastMutation(
    () => {
      return giveRole(newEmail, newRole, domain)
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setNewEmail("")
        roleQuery.refetch()
      },
      onError: setMutationError,
    },
  )
  const editMutation = useToastMutation(
    ({ email, oldRole, newRole }: { email: string; oldRole: UserRole; newRole: UserRole }) =>
      removeRole(email, oldRole, domain).then(() => giveRole(email, newRole, domain)),
    { notify: true, method: "POST" },
    {
      onSuccess: () => roleQuery.refetch(),
      onError: setMutationError,
    },
  )
  const removeMutation = useToastMutation(
    ({ email, role }: { email: string; role: UserRole }) => {
      return removeRole(email, role, domain)
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => roleQuery.refetch(),
      onError: setMutationError,
    },
  )

  let userList
  if (roleQuery.isLoading) {
    userList = <div>{t("loading-text")}</div>
  }
  if (roleQuery.isError) {
    userList = <ErrorBanner variant="readOnly" error={roleQuery.error} />
  }
  if (roleQuery.isSuccess && roleQuery.data.length == 0) {
    userList = <div>{t("no-roles-found")}</div>
  }
  if (roleQuery.isSuccess && roleQuery.data.length > 0) {
    userList = (
      <div
        className={css`
          overflow: auto;
        `}
      >
        <table
          className={css`
            th {
              font-weight: 500;
              opacity: 0.7;
            }

            margin-top: 67px;
            border-spacing: 0 10px;
            th:not(:first-child),
            td {
              padding-left: 61px;
            }
            width: 100%;
          `}
        >
          <thead>
            <tr
              className={css`
                text-align: left;
              `}
            >
              <th>
                {t("text-field-label-name")}
                <button
                  className={css`
                    cursor: pointer;
                    background-color: transparent;
                    border: 0;
                  `}
                  aria-label={t("sort-by-name")}
                  onClick={(ev) => {
                    const params = new URLSearchParams(searchParams)
                    params.set("sort", SORT_KEY_NAME)
                    router.replace(`?${params.toString()}`)
                    ev.preventDefault()
                    setSorting(SORT_KEY_NAME)
                  }}
                >
                  <CaretArrowDown
                    className={css`
                      margin-bottom: 2px;
                      margin-left: 2px;
                      transform: scale(1.2);
                      path {
                        fill: #000;
                      }
                    `}
                  />{" "}
                </button>
              </th>
              <th>
                {t("label-email")}
                <button
                  className={css`
                    cursor: pointer;
                    background-color: transparent;
                    border: 0;
                  `}
                  aria-label={t("sort-by-email")}
                  onClick={(ev) => {
                    const params = new URLSearchParams(searchParams)
                    params.set("sort", SORT_KEY_EMAIL)
                    router.replace(`?${params.toString()}`)
                    ev.preventDefault()
                    setSorting(SORT_KEY_EMAIL)
                  }}
                >
                  <CaretArrowDown
                    className={css`
                      margin-bottom: 2px;
                      margin-left: 2px;
                      transform: scale(1.2);
                      path {
                        fill: #000;
                      }
                    `}
                  />
                </button>
              </th>
              <th>
                <label htmlFor={"editing-role"}>{t("label-role")}</label>
                <button
                  className={css`
                    cursor: pointer;
                    background-color: transparent;
                    border: 0;
                  `}
                  aria-label={t("sort-by-role")}
                  onClick={(ev) => {
                    const params = new URLSearchParams(searchParams)
                    params.set("sort", SORT_KEY_ROLE)
                    router.replace(`?${params.toString()}`)
                    ev.preventDefault()
                    setSorting(SORT_KEY_ROLE)
                  }}
                >
                  <CaretArrowDown
                    className={css`
                      margin-bottom: 2px;
                      margin-left: 2px;
                      transform: scale(1.2);
                      path {
                        fill: #000;
                      }
                    `}
                  />
                </button>
              </th>
              <th>{t("label-action")}</th>
            </tr>
          </thead>
          <tbody>
            {roleQuery.data.sort(sortRoles).map((ur) => (
              <tr
                className={css`
                  background: #ffffff;
                  td {
                    padding-top: 16px;
                    padding-bottom: 16px;
                    background: #f5f6f7;
                    font-size: 16px;
                    line-height: 20px;
                    color: #1a2333;
                  }
                  & td:first-child {
                    padding-left: 24px;
                  }
                  & td:last-child {
                    padding-right: 24px;
                  }
                  td:first-child {
                    border-top-left-radius: 4px;
                  }

                  td:last-child {
                    border-top-right-radius: 4px;
                  }

                  td:first-child {
                    border-bottom-left-radius: 4px;
                  }

                  td:last-child {
                    border-bottom-right-radius: 4px;
                  }
                `}
                key={ur.user_id + ur.role}
              >
                <td>{ur.first_name ? `${ur.first_name} ${ur.last_name}` : ur.last_name}</td>
                <td>{ur.email}</td>
                {!(editingRole?.userId === ur.user_id && editingRole?.currentRole === ur.role) && (
                  <>
                    <td>{ur.role}</td>
                    <td>
                      <button
                        aria-label={t("edit-role")}
                        className={css`
                          cursor: pointer;
                          background-color: transparent;
                          border: 0;
                          height: 100%;
                          margin-right: 8px;
                        `}
                        onClick={() =>
                          setEditingRole({
                            userId: ur.user_id,
                            currentRole: ur.role,
                            newRole: ur.role,
                          })
                        }
                      >
                        <Pencil size={20} color={"#1A2333"} />
                      </button>
                      <button
                        aria-label={t("remove-role")}
                        className={css`
                          cursor: pointer;
                          background-color: transparent;
                          border: 0;
                          height: 100%;
                        `}
                        onClick={() => removeMutation.mutate({ email: ur.email, role: ur.role })}
                      >
                        <XmarkCircle size={20} color={"#1A2333"} />
                      </button>
                    </td>
                  </>
                )}
                {editingRole?.userId === ur.user_id && editingRole?.currentRole === ur.role && (
                  <>
                    <td>
                      <SelectField
                        id={"editing-role"}
                        onChangeByValue={(role) => {
                          setEditingRole({
                            userId: ur.user_id,
                            currentRole: ur.role,
                            newRole: role as UserRole,
                          })
                        }}
                        options={options(t)}
                        defaultValue={ur.role}
                      />
                    </td>
                    <td>
                      <button
                        aria-label={t("save-edited-role")}
                        className={css`
                          cursor: pointer;
                          background-color: transparent;
                          border: 0;
                          height: 100%;
                          margin-right: 8px;
                        `}
                        onClick={() => {
                          editMutation.mutate({
                            email: ur.email,
                            oldRole: editingRole.currentRole,
                            newRole: editingRole.newRole,
                          })
                          setEditingRole(null)
                        }}
                      >
                        <CheckCircle />
                      </button>{" "}
                      <button
                        aria-label={t("cancel-editing-role")}
                        className={css`
                          cursor: pointer;
                          background-color: transparent;
                          border: 0;
                          height: 100%;
                        `}
                        onClick={() => setEditingRole(null)}
                      >
                        <XmarkCircle />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  let groupAccessSection: React.ReactNode = null
  if (domain.tag !== "Global" && groupAccessQuery.isError) {
    groupAccessSection = <ErrorBanner variant="readOnly" error={groupAccessQuery.error} />
  }
  if (domain.tag !== "Global" && groupAccessQuery.isSuccess && groupAccessQuery.data.length > 0) {
    groupAccessSection = (
      <div
        className={css`
          margin-top: 2rem;
        `}
      >
        <h3>{t("groups-with-access")}</h3>
        <div
          className={css`
            overflow: auto;
          `}
        >
          <table
            className={css`
              width: 100%;
              border-spacing: 0 8px;
              th {
                text-align: left;
                font-weight: 500;
                opacity: 0.7;
                padding-right: 16px;
              }
              td {
                background: #f5f6f7;
                padding: 12px 16px;
              }
              td:first-child {
                border-top-left-radius: 4px;
                border-bottom-left-radius: 4px;
              }
              td:last-child {
                border-top-right-radius: 4px;
                border-bottom-right-radius: 4px;
              }
            `}
          >
            <thead>
              <tr>
                <th>{t("label-name")}</th>
                <th>{t("label-role")}</th>
                <th>{t("group-members-count")}</th>
              </tr>
            </thead>
            <tbody>
              {groupAccessQuery.data.map((row: GroupAccessRow) => (
                <tr key={`${row.group_id}-${row.role}`}>
                  <td>
                    <Link href={manageOrganizationGroupRoute(row.organization_id, row.group_id)}>
                      {row.group_name}
                    </Link>
                  </td>
                  <td>{row.role}</td>
                  <td>{row.member_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <>
      {mutationError && <ErrorBanner variant="readOnly" error={mutationError} />}
      <div
        className={css`
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1rem;

          ${respondToOrLarger.sm} {
            flex-direction: row;
          }
        `}
      >
        <div
          className={css`
            display: flex;
            flex-direction: column;
            width: 100%;
            padding-right: 16px;
          `}
        >
          <TextField
            id={t("label-email")}
            label={t("label-email")}
            placeholder={t("field-enter-email")}
            onChangeByValue={(value) => setNewEmail(value)}
          />
        </div>
        <div
          className={css`
            width: 440px;
            padding: 0;
            margin-bottom: 3px;
          `}
        >
          <SelectField
            className={css`
              select {
                padding: 10px;
              }
            `}
            id={`adding-${t("label-role")}`}
            label={t("label-role")}
            onChangeByValue={(role) => {
              setNewRole(role as UserRole)
            }}
            options={options(t)}
            defaultValue={ASSISTANT}
          />
        </div>
      </div>

      <div
        className={css`
          display: flex;
          flex-direction: column;
          justify-content: center;
        `}
      >
        <Button
          className={css`
            width: 144px;
            padding: 0.7625rem 1.125rem !important;
          `}
          onClick={() => addMutation.mutate()}
          size="medium"
          variant="primary"
        >
          {t("label-add-user")}
        </Button>
      </div>

      {groupAccessSection}
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
