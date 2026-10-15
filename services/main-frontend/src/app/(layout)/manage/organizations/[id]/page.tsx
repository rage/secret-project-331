"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { UseMutationResult } from "@tanstack/react-query"
import { PencilBox, Trash } from "@vectopus/atlas-icons-react"
import type { TFunction } from "i18next"
import { useParams, useRouter } from "next/navigation"
import React from "react"
import { useForm } from "react-hook-form"
import type { Control } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { pageTitleCss } from "@/components/credit-registration/styles"
import {
  getOrganizationOptions,
  getRolesOptions,
  softDeleteOrganizationMutation as softDeleteOrganizationMutationOptions,
  updateOrganizationMutation as updateOrganizationMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  addRole as addRoleFromApi,
  removeRole as removeRoleFromApi,
} from "@/generated/api/sdk.generated"
import type { Options } from "@/generated/api/sdk.generated"
import type {
  Organization,
  RoleUser,
  SoftDeleteOrganizationData,
  UpdateOrganizationData,
  UserRole,
} from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { allOrganizationsRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, Checkbox, QueryResult, TextField, useDialog } from "@/shared-module/components"
import { actionButtonStyle, containerBase } from "@/styles/sharedStyles"

import AddUserPopup from "./AddUserPopup"
import DeleteOrganizationPopup from "./DeleteOrganizationPopup"
import EditUserPopup from "./EditUserPopup"

type NamedRoleUser = RoleUser & { name: string }

interface OrganizationFormFields {
  name: string
  slug: string
  hidden: boolean
}

const fieldLabelCss = css`
  font-size: 14px;
  width: 80px;
  flex-shrink: 0;
`

const fieldValueCss = css`
  font-size: 14px;
`

const flushContainerCss = css`
  ${respondToOrLarger.lg} {
    max-width: none;
    margin: 0;
    padding: 24px 0;
  }
`

const permissionsRowColumnsCss = css`
  display: grid;
  grid-template-columns: 1fr 2fr 2fr auto;
  column-gap: 4px;

  ${respondToOrLarger.lg} {
    grid-template-columns: 1fr 2fr 2fr 1fr;
  }
`

const hiddenCss = css`
  visibility: hidden;
`

const GENERAL_TAB = "general"
const PERMISSIONS_TAB = "permissions"
const DEFAULT_TAB = GENERAL_TAB
const ORGANIZATION_ROLE_DOMAIN_TAG = "Organization" as const

type TabKey = typeof GENERAL_TAB | typeof PERMISSIONS_TAB

const ManageOrganization: React.FC = () => {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const [activeTab, setActiveTab] = React.useState<TabKey>(DEFAULT_TAB)
  const [showAddUserPopup, setShowAddUserPopup] = React.useState(false)
  const [editMode, setEditMode] = React.useState(false)
  const [users, setUsers] = React.useState<NamedRoleUser[]>([])
  const [showEditPopup, setShowEditPopup] = React.useState(false)
  const [editUser, setEditUser] = React.useState<RoleUser | null>(null)
  const [editRole, setEditRole] = React.useState("")
  const [showDeletePopup, setShowDeletePopup] = React.useState(false)
  const { control, watch, reset } = useForm<OrganizationFormFields>({
    defaultValues: { name: "", slug: "", hidden: false },
  })
  const fields = watch()

  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const addMutation = useToastMutation(
    (data: { email: string; role: string }) => {
      return addRoleFromApi({
        body: {
          email: data.email,
          role: data.role as UserRole,
          domain: { tag: ORGANIZATION_ROLE_DOMAIN_TAG, id },
        },
      })
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setShowAddUserPopup(false)
        roleQuery.refetch()
      },
    },
  )

  const editUserRoleMutation = useToastMutation(
    async (data: { email: string; oldRole: UserRole; newRole: UserRole }) => {
      await removeRoleFromApi({
        body: {
          email: data.email,
          role: data.oldRole,
          domain: { tag: ORGANIZATION_ROLE_DOMAIN_TAG, id },
        },
      })
      return addRoleFromApi({
        body: {
          email: data.email,
          role: data.newRole,
          domain: { tag: ORGANIZATION_ROLE_DOMAIN_TAG, id },
        },
      })
    },
    { notify: true, method: "PUT" },
    {
      onSuccess: () => {
        roleQuery.refetch()
        setShowEditPopup(false)
      },
      onError: (error) => {
        console.error("Failed to update role", error)
      },
    },
  )

  const deleteMutation = useToastMutationOptions(
    softDeleteOrganizationMutationOptions(),
    { notify: true, method: "DELETE" },
    {
      onSuccess: () => {
        setTimeout(() => {
          router.push(allOrganizationsRoute())
        }, 1500)
      },
    },
  )

  const handleDelete = async (userToDelete: NamedRoleUser) => {
    const confirmed = await confirm({
      message: t("confirm-delete-user", { email: userToDelete.email }),
      isDestructive: true,
    })
    if (!confirmed) {
      return
    }
    try {
      await removeRoleFromApi({
        body: {
          email: userToDelete.email,
          role: userToDelete.role,
          domain: { tag: ORGANIZATION_ROLE_DOMAIN_TAG, id },
        },
      })
      roleQuery.refetch()
    } catch (error) {
      console.error("Failed to delete user role:", error)
    }
  }

  const handleEdit = (userToEdit: NamedRoleUser) => {
    setEditUser(userToEdit)
    setEditRole(userToEdit.role)
    setShowEditPopup(true)
  }

  const handleSaveEdit = () => {
    if (!editUser || !editRole || editRole === editUser.role) {
      setShowEditPopup(false)
      return
    }
    editUserRoleMutation.mutate({
      email: editUser.email,
      oldRole: editUser.role,
      newRole: editRole as UserRole,
    })
  }

  const updateOrgMutation = useToastMutationOptions(
    updateOrganizationMutationOptions(),
    { notify: true, method: "PUT" },
    {
      onSuccess: () => {
        setEditMode(false)
        organization.refetch()
      },
    },
  )

  const roleQuery = useQuery({
    ...getRolesOptions({
      query: { organization_id: id },
    }),
  })

  const organization = useQuery({
    ...getOrganizationOptions({
      path: {
        organization_id: id,
      },
    }),
  })

  usePageTitle(organization.data?.name ?? null)

  React.useEffect(() => {
    if (roleQuery.data) {
      setUsers(
        roleQuery.data.map((user) => ({
          ...user,
          name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
        })),
      )
    }
  }, [roleQuery.data])

  React.useEffect(() => {
    setShowAddUserPopup(false)
  }, [activeTab])

  React.useEffect(() => {
    if (organization.data) {
      reset({
        name: organization.data.name,
        slug: organization.data.slug,
        hidden: organization.data.hidden,
      })
    }
  }, [organization.data, reset])

  return (
    <div
      className={css`
        flex-grow: 1;
        display: flex;
        justify-content: center;
      `}
    >
      {/*<OrganizationSidebar />*/}
      <div
        className={css`
          width: 100%;
        `}
      >
        <QueryResult query={organization}>
          {(organizationData) =>
            content(
              t,
              activeTab,
              setActiveTab,
              setShowAddUserPopup,
              editMode,
              setEditMode,
              users,
              handleDelete,
              handleEdit,
              control,
              fields,
              updateOrgMutation,
              id,
              organizationData,
              showDeletePopup,
              setShowDeletePopup,
              deleteMutation,
            )
          }
        </QueryResult>
        <AddUserPopup
          show={showAddUserPopup}
          onClose={() => setShowAddUserPopup(false)}
          onSave={(data) => addMutation.mutate(data)}
        />

        {editUser && (
          <EditUserPopup
            show={showEditPopup}
            setShow={setShowEditPopup}
            name={`${editUser.first_name} ${editUser.last_name}`}
            email={editUser.email}
            role={editRole}
            setRole={setEditRole}
            handleSave={handleSaveEdit}
          />
        )}
      </div>
    </div>
  )
}

const content = (
  t: TFunction,
  activeTab: TabKey,
  setActiveTab: React.Dispatch<React.SetStateAction<TabKey>>,
  setShowAddUserPopup: React.Dispatch<React.SetStateAction<boolean>>,
  editMode: boolean,
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>,
  users: NamedRoleUser[],
  handleDelete: (user: NamedRoleUser) => void,
  handleEdit: (user: NamedRoleUser) => void,
  control: Control<OrganizationFormFields>,
  fields: OrganizationFormFields,
  updateOrgMutation: UseMutationResult<unknown, Error, Options<UpdateOrganizationData>, unknown>,
  id: string,
  organization: Organization,
  showDeletePopup: boolean,
  setShowDeletePopup: React.Dispatch<React.SetStateAction<boolean>>,
  deleteMutation: UseMutationResult<unknown, Error, Options<SoftDeleteOrganizationData>, unknown>,
) => (
  <div
    className={css`
      width: 100%;
      margin: 0 auto;

      ${respondToOrLarger.lg} {
        width: auto;
        max-width: none;
      }
    `}
  >
    <h1 className={pageTitleCss}>
      {t("link-manage-organization-with-name", { name: organization.name || organization.slug })}
    </h1>

    <div
      className={css`
        display: flex;
        gap: 24px;
        margin: 20px 0 0 0;
        border-bottom: 2px solid rgba(26, 35, 51, 0.2);
        font-family: ${primaryFont};
      `}
    >
      <div
        role="tablist"
        className={css`
          display: flex;
          flex-direction: row;
          align-items: flex-start;
        `}
      >
        <div
          id="tab-general"
          role="tab"
          aria-selected={activeTab === GENERAL_TAB}
          aria-controls="tab-panel-general"
          tabIndex={0}
          onClick={() => setActiveTab(GENERAL_TAB)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setActiveTab(GENERAL_TAB)
            }
          }}
          className={css`
            padding-bottom: 8px;
            font-size: 16px;
            margin-right: 1.5rem;
            border-bottom: ${activeTab === GENERAL_TAB ? "2px solid #1A2333" : "none"};
            cursor: pointer;
          `}
        >
          {t("general")}
        </div>

        <div
          id="tab-permissions"
          role="tab"
          aria-selected={activeTab === PERMISSIONS_TAB}
          aria-controls="tab-panel-permissions"
          tabIndex={0}
          onClick={() => setActiveTab(PERMISSIONS_TAB)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setActiveTab(PERMISSIONS_TAB)
            }
          }}
          className={css`
            padding-bottom: 8px;
            font-size: 16px;
            border-bottom: ${activeTab === PERMISSIONS_TAB ? "2px solid #1A2333" : "none"};
            cursor: pointer;
          `}
        >
          {t("link-permissions")}
        </div>
      </div>
    </div>

    {activeTab === "general" ? (
      <div id="tab-panel-general" role="tabpanel" aria-labelledby="tab-general">
        {designContent(
          t,
          editMode,
          setEditMode,
          control,
          fields,
          updateOrgMutation,
          id,
          showDeletePopup,
          setShowDeletePopup,
          deleteMutation,
        )}
      </div>
    ) : (
      <div id="tab-panel-permissions" role="tabpanel" aria-labelledby="tab-permissions">
        {permissionContent(t, setShowAddUserPopup, users, handleDelete, handleEdit)}
      </div>
    )}
  </div>
)

const designContent = (
  t: TFunction,
  editMode: boolean,
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>,
  control: Control<OrganizationFormFields>,
  fields: OrganizationFormFields,
  updateOrgMutation: UseMutationResult<unknown, Error, Options<UpdateOrganizationData>, unknown>,
  id: string,
  showDeletePopup: boolean,
  setShowDeletePopup: React.Dispatch<React.SetStateAction<boolean>>,
  deleteMutation: UseMutationResult<unknown, Error, Options<SoftDeleteOrganizationData>, unknown>,
) => {
  return (
    <div className={cx(containerBase, flushContainerCss)}>
      <div
        className={css`
          margin-bottom: 32px;
          font-size: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 30px;
        `}
      >
        <span>{t("general")}</span>
        <Button
          variant="primary"
          size="medium"
          onClick={() => setEditMode(true)}
          disabled={editMode}
          {...omitUndefined({ className: editMode ? hiddenCss : undefined })}
        >
          {t("edit")}
        </Button>
      </div>

      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 400px;
        `}
      >
        {/* NAME FIELD */}
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 24px;
          `}
        >
          {editMode ? (
            <TextField name="name" control={control} label={t("label-name")} />
          ) : (
            <>
              <span className={fieldLabelCss}>{t("label-name")}</span>
              <span className={fieldValueCss}>{fields.name}</span>
            </>
          )}
        </div>

        {/* VISIBILITY FIELD */}
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 24px;
          `}
        >
          <span className={fieldLabelCss}>{t("visibility")}</span>

          {editMode ? (
            <Checkbox name="hidden" control={control} label={t("hide")} isInline />
          ) : (
            <span className={fieldValueCss}>
              {fields.hidden ? t("visibility-false") : t("visibility-true")}
            </span>
          )}
        </div>

        {/* SLUG FIELD */}
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 24px;
          `}
        >
          {editMode ? (
            <TextField
              name="slug"
              control={control}
              label={t("text-field-label-or-header-slug-or-short-name")}
            />
          ) : (
            <>
              <span className={fieldLabelCss}>
                {t("text-field-label-or-header-slug-or-short-name")}
              </span>
              <span
                className={css`
                  font-size: 14px;
                  font-family: ${primaryFont};
                  line-height: 20px;
                  color: #1a2333;
                `}
              >
                {fields.slug}
              </span>
            </>
          )}
        </div>

        {editMode && (
          <div>
            <Button variant="secondary" size="medium" onClick={() => setShowDeletePopup(true)}>
              {t("delete-organization")}
            </Button>

            <DeleteOrganizationPopup
              show={showDeletePopup}
              setShow={setShowDeletePopup}
              handleDelete={() => {
                deleteMutation.mutate({
                  path: {
                    organization_id: id,
                  },
                })
              }}
            />
          </div>
        )}

        {/* BUTTONS */}
        <div
          className={css`
            display: flex;
            gap: 12px;
            margin-top: 16px;
            height: 50px;
          `}
        >
          {editMode ? (
            <>
              <Button
                variant="primary"
                size="medium"
                onClick={() => {
                  updateOrgMutation.mutate({
                    body: {
                      name: fields.name,
                      hidden: fields.hidden,
                      slug: fields.slug,
                    },
                    path: {
                      organization_id: id,
                    },
                  })
                }}
              >
                {t("button-text-save")}
              </Button>

              <Button variant="tertiary" size="medium" onClick={() => setEditMode(false)}>
                {t("button-text-cancel")}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const permissionContent = (
  t: TFunction,
  setShowAddUserPopup: React.Dispatch<React.SetStateAction<boolean>>,
  users: NamedRoleUser[],
  handleDelete: (user: NamedRoleUser) => void,
  handleEdit: (user: NamedRoleUser) => void,
) => (
  <div className={cx(containerBase, flushContainerCss)}>
    <div
      className={css`
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        margin-bottom: 24px;

        ${respondToOrLarger.lg} {
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
        }
      `}
    >
      <h2
        className={css`
          font-size: 18px;
          margin-bottom: 16px;

          ${respondToOrLarger.lg} {
            margin-bottom: 0;
          }
        `}
      >
        {t("organization-permissions")}
      </h2>
      <Button variant="primary" size="medium" onClick={() => setShowAddUserPopup(true)}>
        {t("label-add-user")}
      </Button>
    </div>

    <div
      className={css`
        overflow-x: auto;
        width: 100%;
      `}
    >
      <div
        className={css`
          min-width: 600px; /* Or adjust based on your grid */
        `}
      >
        <div
          className={cx(
            permissionsRowColumnsCss,
            css`
              font-size: 14px;
              margin-bottom: 16px;
              opacity: 0.8;
            `,
          )}
        >
          <div>{t("text-field-label-name")}</div>
          <div>{t("label-email")}</div>
          <div>{t("label-role")}</div>
          <div>{t("actions")}</div>
        </div>

        <hr
          className={css`
            border: 1px solid #ced1d7;
            margin-bottom: 16px;
          `}
        />

        {users.map((user, index) => (
          <div key={index}>
            <div
              className={cx(
                permissionsRowColumnsCss,
                css`
                  font-size: 14px;
                  margin-bottom: 16px;
                  opacity: 0.8;
                `,
              )}
            >
              <div>{user.name}</div>
              <div>{user.email}</div>
              <div>{user.role}</div>
              <div
                className={css`
                  display: flex;
                  gap: 0px;
                  justify-content: flex-end;
                  ${respondToOrLarger.lg} {
                    gap: 8px;
                    justify-content: unset;
                  }
                `}
              >
                <button
                  className={actionButtonStyle}
                  onClick={() => handleEdit(user)}
                  aria-label={t("edit-user", { name: user.name })}
                >
                  <PencilBox size={16} />
                </button>

                <button
                  className={actionButtonStyle}
                  onClick={() => handleDelete(user)}
                  aria-label={t("delete-user", { name: user.name })}
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>

            <hr
              className={css`
                border: 1px solid #ced1d7;
                margin-bottom: 16px;
              `}
            />
          </div>
        ))}
      </div>
    </div>
  </div>
)

export default withErrorBoundary(withSignedIn(ManageOrganization))
