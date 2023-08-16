import { css } from "@emotion/css"
import { Check, Clear, Create, ExpandMore } from "@mui/icons-material"
import { useQuery } from "@tanstack/react-query"
import { t as globalT, TFunction } from "i18next"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { assert, Equals } from "tsafe"

import { fetchPendingRoles } from "../services/backend/pendingRoles"
import { fetchRoles, giveRole, removeRole } from "../services/backend/roles"
import { RoleDomain, RoleQuery, RoleUser, UserRole } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"
import ErrorBanner from "../shared-module/components/ErrorBanner"
import SelectField from "../shared-module/components/InputFields/SelectField"
import TextField from "../shared-module/components/InputFields/TextField"
import useToastMutation from "../shared-module/hooks/useToastMutation"
import { respondToOrLarger } from "../shared-module/styles/respond"

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
  ]
}

// Check we have options for all the roles in the system
const allRoles = options(globalT).map((o) => o.value)
type rolesInTheForm = (typeof allRoles)[number]
// Check if two string unions are the same. If this fails, you have changed the UserRole type and need to update the options function above.
assert<Equals<rolesInTheForm, UserRole>>()

interface EditingRole {
  userId: string
  newRole: UserRole
}

interface Props {
  domain: RoleDomain
}

export const PermissionPage: React.FC<React.PropsWithChildren<Props>> = ({ domain }) => {
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
  const [mutationError, setMutationError] = useState<unknown | null>(null)
  const roleQuery = useQuery({
    queryKey: [`roles`, domain, query],
    queryFn: () => fetchRoles(query),
  })
  const pendingRolesQuery = useQuery({
    queryKey: [`pending-roles`, domain, query],
    queryFn: () => fetchPendingRoles(query),
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
                <td>{ur.first_name ? `${ur.first_name} ${ur.last_name}` : ur.last_name}</td>
                <td>{ur.email}</td>
                {editingRole?.userId !== ur.id && (
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
                        onClick={() => setEditingRole({ userId: ur.id, newRole: ur.role })}
                      >
                        <Create />
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
                        <Clear />
                      </button>
                    </td>
                  </>
                )}
                {editingRole?.userId === ur.id && (
                  <>
                    <td>
                      <SelectField
                        id={"editing-role"}
                        onChangeByValue={(role) => {
                          setEditingRole({ userId: ur.id, newRole: role as UserRole })
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
                            oldRole: ur.role,
                            newRole: editingRole.newRole,
                          })
                          setEditingRole(null)
                        }}
                      >
                        <Check />
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
                        <Clear />
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

  return (
    <>
      {mutationError && <ErrorBanner variant="readOnly" error={mutationError} />}
      <div
        className={css`
          display: flex;
          flex-direction: column;
          justify-content: space-around;

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
            display: flex;
            flex-direction: column;
            width: 200px;
            padding-right: 16px;
          `}
        >
          <SelectField
            id={`adding-${t("label-role")}`}
            label={t("label-role")}
            onChangeByValue={(role) => {
              setNewRole(role as UserRole)
            }}
            options={options(t)}
            defaultValue={ASSISTANT}
          />
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
