"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { USER_ROLES } from "@/constants/roles"
import {
  addGroupMember,
  addGroupRole,
  deleteGroup,
  fetchGroup,
  fetchGroupMembers,
  fetchGroupRoles,
  removeGroupMember,
  removeGroupRole,
  renameGroup,
} from "@/services/backend/groups"
import { GroupRoleAssignment, RoleDomain, UserRole } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { manageOrganizationGroupsRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

type GroupScopeTag = "Organization" | "Course" | "CourseInstance" | "Exam"

function roleAssignmentToDomain(role: GroupRoleAssignment): RoleDomain {
  if (role.organization_id) {
    // eslint-disable-next-line i18next/no-literal-string -- RoleDomain tag discriminant
    return { tag: "Organization", id: role.organization_id }
  }
  if (role.course_id) {
    // eslint-disable-next-line i18next/no-literal-string -- RoleDomain tag discriminant
    return { tag: "Course", id: role.course_id }
  }
  if (role.course_instance_id) {
    // eslint-disable-next-line i18next/no-literal-string -- RoleDomain tag discriminant
    return { tag: "CourseInstance", id: role.course_instance_id }
  }
  if (role.exam_id) {
    // eslint-disable-next-line i18next/no-literal-string -- RoleDomain tag discriminant
    return { tag: "Exam", id: role.exam_id }
  }
  // eslint-disable-next-line i18next/no-literal-string
  throw new Error("Invalid group role assignment domain")
}

function roleAssignmentScopeLabel(role: GroupRoleAssignment): string {
  if (role.organization_id) {
    // eslint-disable-next-line i18next/no-literal-string -- Debug/admin scope label
    return `Organization (${role.organization_id})`
  }
  if (role.course_id) {
    // eslint-disable-next-line i18next/no-literal-string -- Debug/admin scope label
    return `Course (${role.course_id})`
  }
  if (role.course_instance_id) {
    // eslint-disable-next-line i18next/no-literal-string -- Debug/admin scope label
    return `CourseInstance (${role.course_instance_id})`
  }
  if (role.exam_id) {
    // eslint-disable-next-line i18next/no-literal-string -- Debug/admin scope label
    return `Exam (${role.exam_id})`
  }
  // eslint-disable-next-line i18next/no-literal-string -- Debug/admin fallback label
  return "Unknown"
}

const OrganizationGroupDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { id: organizationId, groupId } = useParams<{ id: string; groupId: string }>()

  const [renameValue, setRenameValue] = useState("")
  const [newMemberEmail, setNewMemberEmail] = useState("")
  // eslint-disable-next-line i18next/no-literal-string -- UserRole enum discriminant default
  const [newRole, setNewRole] = useState<UserRole>("Assistant")
  // eslint-disable-next-line i18next/no-literal-string -- RoleDomain tag discriminant default
  const [scopeTag, setScopeTag] = useState<GroupScopeTag>("Organization")
  const [scopeId, setScopeId] = useState("")
  const [mutationError, setMutationError] = useState<unknown | null>(null)

  const groupQuery = useQuery({
    queryKey: ["group-detail", groupId],
    queryFn: () => fetchGroup(groupId),
  })
  const membersQuery = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: () => fetchGroupMembers(groupId),
  })
  const rolesQuery = useQuery({
    queryKey: ["group-roles", groupId],
    queryFn: () => fetchGroupRoles(groupId),
  })

  useEffect(() => {
    if (groupQuery.data) {
      setRenameValue(groupQuery.data.group.name)
      setScopeId(groupQuery.data.group.organization_id)
    }
  }, [groupQuery.data])

  const renameMutation = useToastMutation(
    () => renameGroup(groupId, renameValue),
    { notify: true, method: "PATCH" },
    {
      onSuccess: () => {
        setMutationError(null)
        void groupQuery.refetch()
      },
      onError: setMutationError,
    },
  )
  const deleteMutation = useToastMutation(
    () => deleteGroup(groupId),
    { notify: true, method: "DELETE" },
    {
      onSuccess: () => {
        setMutationError(null)
        router.push(manageOrganizationGroupsRoute(organizationId))
      },
      onError: setMutationError,
    },
  )
  const addMemberMutation = useToastMutation(
    () => addGroupMember(groupId, newMemberEmail),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setNewMemberEmail("")
        setMutationError(null)
        void membersQuery.refetch()
      },
      onError: setMutationError,
    },
  )
  const removeMemberMutation = useToastMutation(
    (userId: string) => removeGroupMember(groupId, userId),
    { notify: true, method: "DELETE" },
    {
      onSuccess: () => {
        setMutationError(null)
        void membersQuery.refetch()
      },
      onError: setMutationError,
    },
  )
  const addRoleMutation = useToastMutation(
    (domain: RoleDomain) => addGroupRole(groupId, newRole, domain),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setMutationError(null)
        void rolesQuery.refetch()
      },
      onError: setMutationError,
    },
  )
  const removeRoleMutation = useToastMutation(
    ({ role, domain }: { role: UserRole; domain: RoleDomain }) =>
      removeGroupRole(groupId, role, domain),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setMutationError(null)
        void rolesQuery.refetch()
      },
      onError: setMutationError,
    },
  )

  const buildRoleDomain = (): RoleDomain | null => {
    const trimmedScopeId =
      scopeTag === "Organization" ? (groupQuery.data?.group.organization_id ?? "") : scopeId.trim()
    if (!trimmedScopeId) {
      return null
    }
    return {
      tag: scopeTag,
      id: trimmedScopeId,
    } as RoleDomain
  }

  const isLoading = groupQuery.isLoading || membersQuery.isLoading || rolesQuery.isLoading
  const hasError = groupQuery.isError || membersQuery.isError || rolesQuery.isError

  return (
    <div
      className={css`
        margin-top: 40px;
        ${respondToOrLarger.sm} {
          margin-top: 80px;
        }
      `}
    >
      {mutationError != null && <ErrorBanner variant="readOnly" error={mutationError} />}
      {isLoading && <Spinner variant="large" />}
      {groupQuery.isError && <ErrorBanner variant="readOnly" error={groupQuery.error} />}
      {membersQuery.isError && <ErrorBanner variant="readOnly" error={membersQuery.error} />}
      {rolesQuery.isError && <ErrorBanner variant="readOnly" error={rolesQuery.error} />}

      {!hasError && groupQuery.isSuccess && membersQuery.isSuccess && rolesQuery.isSuccess && (
        <div
          className={css`
            display: grid;
            gap: 24px;
          `}
        >
          <div>
            <Link href={manageOrganizationGroupsRoute(organizationId)}>{t("back-to-groups")}</Link>
            <h1
              className={css`
                margin-top: 8px;
              `}
            >
              {groupQuery.data.group.name}
            </h1>
            <p
              className={css`
                opacity: 0.75;
              `}
            >
              {groupQuery.data.group.id}
            </p>
          </div>

          <section
            className={css`
              background: #f5f6f7;
              border-radius: 8px;
              padding: 16px;
            `}
          >
            <h2>{t("group-details")}</h2>
            <div
              className={css`
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                align-items: end;
              `}
            >
              <div
                className={css`
                  flex: 1 1 280px;
                `}
              >
                <label htmlFor="group-name-input">{t("group-name")}</label>
                <input
                  id="group-name-input"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  disabled={!groupQuery.data.capabilities.can_manage_group}
                  className={css`
                    width: 100%;
                    border: 1px solid #ced1d7;
                    border-radius: 4px;
                    padding: 10px 12px;
                    margin-top: 6px;
                    background: ${groupQuery.data.capabilities.can_manage_group ? "#fff" : "#eee"};
                  `}
                />
              </div>
              {groupQuery.data.capabilities.can_manage_group && (
                <>
                  <Button
                    variant="primary"
                    size="medium"
                    onClick={() => renameMutation.mutate()}
                    disabled={!renameValue.trim()}
                  >
                    {t("rename-group")}
                  </Button>
                  <Button
                    variant="reject"
                    size="medium"
                    onClick={() => {
                      if (
                        window.confirm(
                          t("confirm-delete-group", { name: groupQuery.data.group.name }),
                        )
                      ) {
                        deleteMutation.mutate()
                      }
                    }}
                  >
                    {t("delete-group")}
                  </Button>
                </>
              )}
            </div>
          </section>

          <section
            className={css`
              background: #f5f6f7;
              border-radius: 8px;
              padding: 16px;
            `}
          >
            <h2>{t("group-members")}</h2>

            {groupQuery.data.capabilities.can_manage_members && (
              <div
                className={css`
                  display: flex;
                  flex-wrap: wrap;
                  gap: 12px;
                  margin-bottom: 16px;
                  align-items: end;
                `}
              >
                <div
                  className={css`
                    flex: 1 1 300px;
                  `}
                >
                  <label htmlFor="group-member-email">{t("label-email")}</label>
                  <input
                    id="group-member-email"
                    value={newMemberEmail}
                    onChange={(event) => setNewMemberEmail(event.target.value)}
                    placeholder={t("field-enter-email")}
                    className={css`
                      width: 100%;
                      border: 1px solid #ced1d7;
                      border-radius: 4px;
                      padding: 10px 12px;
                      margin-top: 6px;
                    `}
                  />
                </div>
                <Button
                  variant="primary"
                  size="medium"
                  onClick={() => addMemberMutation.mutate()}
                  disabled={!newMemberEmail.trim()}
                >
                  {t("add-group-member")}
                </Button>
              </div>
            )}

            {membersQuery.data.length === 0 && <p>{t("no-group-members")}</p>}
            {membersQuery.data.length > 0 && (
              <div
                className={css`
                  display: grid;
                  gap: 8px;
                `}
              >
                {membersQuery.data.map((member) => (
                  <div
                    key={member.user_id}
                    className={css`
                      background: #fff;
                      border-radius: 6px;
                      border: 1px solid #e4e5e8;
                      padding: 12px;
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      gap: 12px;
                    `}
                  >
                    <div>
                      <div>
                        {(member.first_name || member.last_name
                          ? `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim()
                          : member.email) || member.email}
                      </div>
                      <div
                        className={css`
                          opacity: 0.75;
                          font-size: 14px;
                        `}
                      >
                        {member.email}
                      </div>
                    </div>
                    {groupQuery.data.capabilities.can_manage_members && (
                      <Button
                        variant="outlined"
                        size="small"
                        transform="none"
                        onClick={() => {
                          if (
                            window.confirm(
                              t("confirm-remove-group-member", { email: member.email }),
                            )
                          ) {
                            removeMemberMutation.mutate(member.user_id)
                          }
                        }}
                      >
                        {t("remove")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            className={css`
              background: #f5f6f7;
              border-radius: 8px;
              padding: 16px;
            `}
          >
            <h2>{t("group-role-assignments")}</h2>

            {groupQuery.data.capabilities.can_manage_group_roles ? (
              <div
                className={css`
                  display: grid;
                  gap: 12px;
                  margin-bottom: 16px;
                `}
              >
                <div
                  className={css`
                    display: grid;
                    gap: 12px;
                    ${respondToOrLarger.md} {
                      grid-template-columns: 1fr 1fr 2fr auto;
                      align-items: end;
                    }
                  `}
                >
                  <div>
                    <label htmlFor="group-role-select">{t("label-role")}</label>
                    <select
                      id="group-role-select"
                      value={newRole}
                      onChange={(event) => setNewRole(event.target.value as UserRole)}
                      className={css`
                        width: 100%;
                        border: 1px solid #ced1d7;
                        border-radius: 4px;
                        padding: 10px 12px;
                        margin-top: 6px;
                      `}
                    >
                      {USER_ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {t(role.translationKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="group-role-scope-type">{t("group-role-scope-type")}</label>
                    <select
                      id="group-role-scope-type"
                      value={scopeTag}
                      onChange={(event) => setScopeTag(event.target.value as GroupScopeTag)}
                      className={css`
                        width: 100%;
                        border: 1px solid #ced1d7;
                        border-radius: 4px;
                        padding: 10px 12px;
                        margin-top: 6px;
                      `}
                    >
                      <option value="Organization">{t("organization")}</option>
                      <option value="Course">{t("course")}</option>
                      <option value="CourseInstance">{t("course-instance")}</option>
                      <option value="Exam">{t("exam")}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="group-role-scope-id">{t("group-role-scope-id")}</label>
                    <input
                      id="group-role-scope-id"
                      value={
                        scopeTag === "Organization"
                          ? (groupQuery.data.group.organization_id ?? "")
                          : scopeId
                      }
                      onChange={(event) => setScopeId(event.target.value)}
                      disabled={scopeTag === "Organization"}
                      placeholder={t("group-role-scope-id-placeholder")}
                      className={css`
                        width: 100%;
                        border: 1px solid #ced1d7;
                        border-radius: 4px;
                        padding: 10px 12px;
                        margin-top: 6px;
                        background: ${scopeTag === "Organization" ? "#eee" : "#fff"};
                      `}
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="medium"
                    onClick={() => {
                      const domain = buildRoleDomain()
                      if (domain) {
                        addRoleMutation.mutate(domain)
                      }
                    }}
                    disabled={!buildRoleDomain()}
                  >
                    {t("add-group-role")}
                  </Button>
                </div>
                <p
                  className={css`
                    margin: 0;
                    opacity: 0.75;
                    font-size: 14px;
                  `}
                >
                  {t("group-role-same-org-note")}
                </p>
              </div>
            ) : (
              <p>{t("group-roles-read-only-note")}</p>
            )}

            {rolesQuery.data.length === 0 && <p>{t("no-group-roles")}</p>}
            {rolesQuery.data.length > 0 && (
              <div
                className={css`
                  display: grid;
                  gap: 8px;
                `}
              >
                {rolesQuery.data.map((roleAssignment) => (
                  <div
                    key={roleAssignment.id}
                    className={css`
                      background: #fff;
                      border-radius: 6px;
                      border: 1px solid #e4e5e8;
                      padding: 12px;
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      gap: 12px;
                    `}
                  >
                    <div>
                      <div>{roleAssignment.role}</div>
                      <div
                        className={css`
                          opacity: 0.75;
                          font-size: 14px;
                        `}
                      >
                        {roleAssignmentScopeLabel(roleAssignment)}
                      </div>
                    </div>
                    {groupQuery.data.capabilities.can_manage_group_roles && (
                      <Button
                        variant="outlined"
                        size="small"
                        transform="none"
                        onClick={() => {
                          if (window.confirm(t("confirm-remove-group-role"))) {
                            removeRoleMutation.mutate({
                              role: roleAssignment.role,
                              domain: roleAssignmentToDomain(roleAssignment),
                            })
                          }
                        }}
                      >
                        {t("remove")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(OrganizationGroupDetailPage))
