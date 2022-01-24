import { css } from "@emotion/css"
import { TextField } from "@material-ui/core"
import { Check, Clear, Create, ExpandMore } from "@material-ui/icons"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "react-query"

import { fetchRoles, giveRole, removeRole } from "../services/backend/roles"
import { RoleDomain, RoleQuery, RoleUser, UserRole } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"
import ErrorBanner from "../shared-module/components/ErrorBanner"

const SORT_KEY_NAME = "name"
const SORT_KEY_EMAIL = "email"
const SORT_KEY_ROLE = "role"
const ADMIN: UserRole = "Admin"
const ASSISTANT: UserRole = "Assistant"
const REVIEWER: UserRole = "Reviewer"
const TEACHER: UserRole = "Teacher"

interface EditingRole {
  userId: string
  newRole: UserRole
}

interface Props {
  domain: RoleDomain
}

export const PermissionPage: React.FC<Props> = ({ domain }) => {
  const { t } = useTranslation()
  const router = useRouter()
  let { sort: sort_key } = router.query
  if (typeof sort_key !== "string") {
    sort_key = SORT_KEY_NAME
  }
  const [sorting, setSorting] = useState(sort_key)

  function sortRoles(first: RoleUser, second: RoleUser): number {
    if (sorting == SORT_KEY_NAME) {
      return 0 // first.name.localeCompare(second.name)
    } else if (sorting == SORT_KEY_EMAIL) {
      return first.email.localeCompare(second.email)
    } else if (sorting == SORT_KEY_ROLE) {
      return first.role.localeCompare(second.role)
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
  const roleQuery = useQuery(`roles-${domain}`, () => fetchRoles(query))
  const addMutation = useMutation(
    () => {
      return giveRole(newEmail, newRole, domain)
    },
    { onSuccess: () => roleQuery.refetch() },
  )
  const editMutation = useMutation(
    ({ email, oldRole, newRole }: { email: string; oldRole: UserRole; newRole: UserRole }) =>
      removeRole(email, oldRole, domain).then(() => giveRole(email, newRole, domain)),
    { onSuccess: () => roleQuery.refetch() },
  )
  const removeMutation = useMutation(
    ({ email, role }: { email: string; role: UserRole }) => {
      return removeRole(email, role, domain)
    },
    { onSuccess: () => roleQuery.refetch() },
  )

  let userList
  if (roleQuery.isIdle || roleQuery.isLoading) {
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
                <a
                  href="?sort=name"
                  onClick={(ev) => {
                    router.replace(
                      {
                        query: { ...router.query, sort: SORT_KEY_NAME },
                      },
                      undefined,
                      { shallow: true },
                    )
                    ev.preventDefault()
                    setSorting(SORT_KEY_NAME)
                  }}
                >
                  <ExpandMore />
                </a>
              </th>
              <th>
                {t("label-email")}
                <a
                  href="?sort=email"
                  onClick={(ev) => {
                    router.replace(
                      {
                        query: { ...router.query, sort: SORT_KEY_EMAIL },
                      },
                      undefined,
                      { shallow: true },
                    )
                    ev.preventDefault()
                    setSorting(SORT_KEY_EMAIL)
                  }}
                >
                  <ExpandMore />
                </a>
              </th>
              <th>
                {t("label-role")}
                <a
                  href="?sort=role"
                  onClick={(ev) => {
                    router.replace(
                      {
                        query: { ...router.query, sort: SORT_KEY_ROLE },
                      },
                      undefined,
                      { shallow: true },
                    )
                    ev.preventDefault()
                    setSorting(SORT_KEY_ROLE)
                  }}
                >
                  <ExpandMore />
                </a>
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
                    padding-top: 24px;
                    padding-bottom: 24px;
                    border-top: 1px solid rgba(190, 190, 190, 0.6);
                    border-bottom: 1px solid rgba(190, 190, 190, 0.6);
                    font-size: 20px;
                    line-height: 20px;
                  }
                  & td:first-child {
                    padding-left: 24px;
                    border-left: 1px solid rgba(190, 190, 190, 0.6);
                  }
                  & td:last-child {
                    padding-right: 24px;
                    border-right: 1px solid rgba(190, 190, 190, 0.6);
                  }
                `}
                key={ur.id}
              >
                {
                  // eslint-disable-next-line i18next/no-literal-string
                  <td>placeholder</td>
                }
                <td>{ur.email}</td>
                {editingRole?.userId !== ur.id && (
                  <>
                    <td>{ur.role}</td>
                    <td>
                      <Button
                        variant="secondary"
                        size="medium"
                        onClick={() => setEditingRole({ userId: ur.id, newRole: ur.role })}
                      >
                        <Create />
                      </Button>{" "}
                      <Button
                        variant="secondary"
                        size="medium"
                        onClick={() => removeMutation.mutate({ email: ur.email, role: ur.role })}
                      >
                        <Clear />
                      </Button>
                    </td>
                  </>
                )}
                {editingRole?.userId === ur.id && (
                  <>
                    <td>
                      <select
                        onChange={(ev) =>
                          setEditingRole({ userId: ur.id, newRole: ev.target.value as UserRole })
                        }
                        defaultValue={ur.role}
                      >
                        <option value={ADMIN}>{t("role-admin")}</option>
                        <option value={ASSISTANT}>{t("role-assistant")}</option>
                        <option value={REVIEWER}>{t("role-reviewer")}</option>
                        <option value={TEACHER}>{t("role-teacher")}</option>
                      </select>
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        size="medium"
                        onClick={() => {
                          editMutation.mutate({
                            email: ur.email,
                            oldRole: ur.role,
                            newRole: editingRole.newRole,
                          })
                          setEditingRole(null)
                        }}
                      >
                        <Check />
                      </Button>{" "}
                      <Button
                        variant="secondary"
                        size="medium"
                        onClick={() => setEditingRole(null)}
                      >
                        <Clear />
                      </Button>
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

  return (
    <>
      {roleQuery.isError && <ErrorBanner variant="readOnly" error={roleQuery.error} />}
      <div
        className={css`
          display: flex;
          justify-content: space-around;
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
          <label htmlFor="email">{t("label-email")}</label>
          <TextField
            id="email"
            placeholder={t("field-enter-email")}
            onChange={(ev) => setNewEmail(ev.target.value)}
          />
        </div>

        <div
          className={css`
            display: flex;
            flex-direction: column;
            width: 144px;
            padding-right: 16px;
          `}
        >
          <label htmlFor="role">{t("label-role")}</label>
          <select
            id="role"
            name="role"
            defaultValue={ASSISTANT}
            onChange={(ev) => setNewRole(ev.target.value as UserRole)}
          >
            <option value={ADMIN}>{t("role-admin")}</option>
            <option value={ASSISTANT}>{t("role-assistant")}</option>
            <option value={REVIEWER}>{t("role-reviewer")}</option>
            <option value={TEACHER}>{t("role-teacher")}</option>
          </select>
        </div>

        <Button
          className={css`
            width: 144px;
          `}
          onClick={() => addMutation.mutate()}
          size="medium"
          variant="primary"
        >
          {t("label-add-user")}
        </Button>
      </div>

      {userList}
    </>
  )
}
