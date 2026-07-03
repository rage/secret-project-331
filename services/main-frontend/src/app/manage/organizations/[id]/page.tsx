"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { UseMutationResult } from "@tanstack/react-query"
import { PencilBox, Trash } from "@vectopus/atlas-icons-react"
import type { TFunction } from "i18next"
import { useParams, useRouter } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import AddUserPopup from "./AddUserPopup"
import DeleteOrganizationPopup from "./DeleteOrganizationPopup"
import EditUserPopup from "./EditUserPopup"

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
import Button from "@/shared-module/common/components/Button"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { allOrganizationsRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"
import {
  actionButtonStyle,
  containerBase,
  disabledButton,
  primaryButton,
} from "@/styles/sharedStyles"

type NamedRoleUser = RoleUser & { name: string }

const GENERAL_TAB = "general"
const PERMISSIONS_TAB = "permissions"
const DEFAULT_TAB = GENERAL_TAB
const ORGANIZATION_ROLE_DOMAIN_TAG = "Organization" as const

type TabKey = typeof GENERAL_TAB | typeof PERMISSIONS_TAB

const ManageOrganization: React.FC = () => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = React.useState<TabKey>(DEFAULT_TAB)
  const [showAddUserPopup, setShowAddUserPopup] = React.useState(false)
  const [editMode, setEditMode] = React.useState(false)
  const [users, setUsers] = React.useState<NamedRoleUser[]>([])
  const [hidden, setHidden] = React.useState(false)
  const [showEditPopup, setShowEditPopup] = React.useState(false)
  const [editUser, setEditUser] = React.useState<RoleUser | null>(null)
  const [editRole, setEditRole] = React.useState("")
  const [editedName, setEditedName] = React.useState("")
  const [showDeletePopup, setShowDeletePopup] = React.useState(false)
  const [editedSlug, setEditedSlug] = React.useState("")

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

  const handleDelete = (userToDelete: NamedRoleUser) => {
    if (window.confirm(t("confirm-delete-user", { email: userToDelete.email }))) {
      removeRoleFromApi({
        body: {
          email: userToDelete.email,
          role: userToDelete.role,
          domain: { tag: ORGANIZATION_ROLE_DOMAIN_TAG, id },
        },
      })
        .then(() => {
          roleQuery.refetch()
        })
        .catch((error) => {
          console.error("Failed to delete user role:", error)
        })
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
      setEditedName(organization.data.name)
      setEditedSlug(organization.data.slug)
      setHidden(organization.data.hidden)
    }
  }, [organization.data])

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
              editedName,
              setEditedName,
              hidden,
              setHidden,
              updateOrgMutation,
              id,
              organizationData,
              showDeletePopup,
              setShowDeletePopup,
              deleteMutation,
              editedSlug,
              setEditedSlug,
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
  editedName: string,
  setEditedName: React.Dispatch<React.SetStateAction<string>>,
  hidden: boolean,
  setHidden: React.Dispatch<React.SetStateAction<boolean>>,
  updateOrgMutation: UseMutationResult<unknown, Error, Options<UpdateOrganizationData>, unknown>,
  id: string,
  organization: Organization,
  showDeletePopup: boolean,
  setShowDeletePopup: React.Dispatch<React.SetStateAction<boolean>>,
  deleteMutation: UseMutationResult<unknown, Error, Options<SoftDeleteOrganizationData>, unknown>,
  editedSlug: string,
  setEditedSlug: React.Dispatch<React.SetStateAction<string>>,
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
    <div
      className={css`
        font-family: ${primaryFont};
        color: #1a2333;
        font-size: 24px;
        ${respondToOrLarger.lg} {
          padding: 40px 40px 0 40px;
        }
      `}
    >
      {t("link-manage-organization-with-name", { name: organization.name ?? "" })}
    </div>

    <div
      className={css`
        display: flex;
        gap: 24px;
        margin: 20px 0 0 0px;
        border-bottom: 2px solid rgba(26, 35, 51, 0.2);
        font-family: ${primaryFont};

        ${respondToOrLarger.lg} {
          margin: 40px 0 0 40px;
        }
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
            margin-right: 0.5rem;
            border-bottom: ${activeTab === GENERAL_TAB ? "2px solid #1A2333" : "none"};
            cursor: pointer;

            ${respondToOrLarger.lg} {
              margin-right: 2rem;
            }
          `}
        >
          {t("general")}
        </div>

        <div
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
          editedName,
          setEditedName,
          hidden,
          setHidden,
          updateOrgMutation,
          id,
          showDeletePopup,
          setShowDeletePopup,
          deleteMutation,
          editedSlug,
          setEditedSlug,
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
  editedName: string,
  setEditedName: React.Dispatch<React.SetStateAction<string>>,
  hidden: boolean,
  setHidden: React.Dispatch<React.SetStateAction<boolean>>,
  updateOrgMutation: UseMutationResult<unknown, Error, Options<UpdateOrganizationData>, unknown>,
  id: string,
  showDeletePopup: boolean,
  setShowDeletePopup: React.Dispatch<React.SetStateAction<boolean>>,
  deleteMutation: UseMutationResult<unknown, Error, Options<SoftDeleteOrganizationData>, unknown>,
  editedSlug: string,
  setEditedSlug: React.Dispatch<React.SetStateAction<string>>,
) => {
  return (
    <div className={containerBase}>
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
        <button
          onClick={() => setEditMode(true)}
          disabled={editMode}
          className={css`
            ${editMode ? disabledButton : primaryButton};
            ${editMode &&
            `
              opacity: 0;
              pointer-events: none;
            `}
          `}
        >
          {t("edit")}
        </button>
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
          <label
            htmlFor="organization-name"
            className={css`
              font-size: 14px;
              width: 80px;
              flex-shrink: 0;
            `}
          >
            {t("label-name")}
          </label>

          {editMode ? (
            <input
              id="organization-name"
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className={css`
                width: 70%;
                border: 2px solid #e4e5e8;
                border-radius: 2px;
                padding: 8px 12px;
                font-size: 14px;
                ${respondToOrLarger.lg} {
                  width: 250px;
                }
              `}
            />
          ) : (
            <span
              className={css`
                font-size: 14px;
              `}
            >
              {editedName}
            </span>
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
          <span
            className={css`
              font-size: 14px;
              width: 80px;
              flex-shrink: 0;
            `}
          >
            {t("visibility")}
          </span>

          {editMode ? (
            <div
              className={css`
                display: flex;
                align-items: center;
                gap: 8px;
              `}
            >
              <label
                className={css`
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  cursor: pointer;
                `}
              >
                <input
                  type="checkbox"
                  checked={hidden}
                  onChange={(e) => setHidden(e.target.checked)}
                  className={css`
                    width: 18px;
                    height: 18px;
                    border: 1px solid #1a2333;
                    border-radius: 2px;
                    cursor: pointer;
                    accent-color: #1a2333;
                  `}
                />
                <span>{t("hide")}</span>
              </label>
            </div>
          ) : (
            <span>{hidden ? t("visibility-false") : t("visibility-true")}</span>
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
          <label
            htmlFor="organization-slug"
            className={css`
              font-size: 14px;
              width: 80px;
              flex-shrink: 0;
            `}
          >
            {t("text-field-label-or-header-slug-or-short-name")}
          </label>

          {editMode ? (
            <input
              id="organization-slug"
              type="text"
              value={editedSlug}
              onChange={(e) => setEditedSlug(e.target.value)}
              className={css`
                width: 70%;
                border: 2px solid #e4e5e8;
                border-radius: 2px;
                padding: 8px 12px;
                font-size: 14px;
                ${respondToOrLarger.lg} {
                  width: 250px;
                }
              `}
            />
          ) : (
            <span
              className={css`
                font-size: 14px;
                font-family: ${primaryFont};
                line-height: 20px;
                color: #1a2333;
              `}
            >
              {editedSlug}
            </span>
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
              <button
                className={primaryButton}
                onClick={() => {
                  updateOrgMutation.mutate({
                    body: {
                      name: editedName,
                      hidden,
                      slug: editedSlug,
                    },
                    path: {
                      organization_id: id,
                    },
                  })
                }}
              >
                {t("button-text-save")}
              </button>

              <button
                className={css`
                  background: transparent;
                  color: #1a2333;
                  padding: 8px 16px;
                  border: none;
                `}
                onClick={() => setEditMode(false)}
              >
                {t("button-text-cancel")}
              </button>
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
  <div className={containerBase}>
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
      <button onClick={() => setShowAddUserPopup(true)} className={primaryButton}>
        {t("label-add-user")}
      </button>
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
          className={css`
            display: grid;
            grid-template-columns: 1fr 2fr 2fr 1fr;
            font-size: 14px;
            margin-bottom: 16px;
            opacity: 0.8;
          `}
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
              className={css`
                display: grid;
                grid-template-columns: 1fr 2fr 2fr auto;
                font-size: 14px;
                margin-bottom: 16px;
                opacity: 0.8;
                column-gap: 4px;
                ${respondToOrLarger.lg} {
                  grid-template-columns: 1fr 2fr 2fr 1fr;
                }
              `}
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
