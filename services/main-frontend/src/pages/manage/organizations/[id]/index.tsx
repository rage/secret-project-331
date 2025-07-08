import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { PencilBox, Trash } from "@vectopus/atlas-icons-react"
import type { TFunction } from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchOrganization, updateOrganization } from "../../../../services/backend/organizations"

import AddUserPopup from "./components/AddUserPopup"
import EditUserPopup from "./components/EditUserPopup"
import {
  actionButtonStyle,
  containerBase,
  disabledButton,
  primaryButton,
} from "./styles/sharedStyles"

import { fetchRoles, giveRole, removeRole } from "@/services/backend/roles"
import { RoleDomain, RoleUser, UserRole } from "@/shared-module/common/bindings"
import type { Organization } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

type NamedRoleUser = RoleUser & { name: string }

const GENERAL_TAB = "general"
const PERMISSIONS_TAB = "permissions"
const DEFAULT_TAB = GENERAL_TAB

type TabKey = typeof GENERAL_TAB | typeof PERMISSIONS_TAB

interface Props {
  query: SimplifiedUrlQuery<"id">
}

const ManageOrganization: React.FC<React.PropsWithChildren<Props>> = ({ query }) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = React.useState<TabKey>(DEFAULT_TAB)
  const [showAddUserPopup, setShowAddUserPopup] = React.useState(false)
  const [editMode, setEditMode] = React.useState(false)
  const [users, setUsers] = React.useState<NamedRoleUser[]>([])
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState("")
  const [hidden, setHidden] = React.useState(false)
  const [showEditPopup, setShowEditPopup] = React.useState(false)
  const [editUser, setEditUser] = React.useState<RoleUser | null>(null)
  const [editRole, setEditRole] = React.useState("")
  const [editedName, setEditedName] = React.useState("")

  const addMutation = useToastMutation(
    () => {
      return giveRole(email, role as UserRole, { tag: t("organization"), id: query.id })
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setEmail("")
        setRole("")
        setShowAddUserPopup(false)
        roleQuery.refetch()
      },
    },
  )

  const handleDelete = (userToDelete: NamedRoleUser) => {
    if (window.confirm(t("confirm-delete-user", { email: userToDelete.email }))) {
      // eslint-disable-next-line i18next/no-literal-string
      removeRole(userToDelete.email, userToDelete.role, { tag: "Organization", id: query.id })
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

    void removeRole(editUser.email, editUser.role, { tag: t("organization"), id: query.id })
      .then(() =>
        giveRole(editUser.email, editRole as UserRole, {
          tag: t("organization"),
          id: query.id,
        }),
      )
      .then(() => {
        roleQuery.refetch()
        setShowEditPopup(false)
      })
      .catch((error) => {
        console.error("Failed to update role", error)
      })
  }

  const updateOrgMutation = useToastMutation(
    (newData: { name: string; hidden: boolean }) =>
      updateOrganization(query.id, newData.name, newData.hidden),
    { notify: true, method: "PUT" },
    {
      onSuccess: () => {
        setEditMode(false)
        organization.refetch()
      },
    },
  )

  // eslint-disable-next-line i18next/no-literal-string
  const domain: RoleDomain = { tag: "Organization", id: query.id }

  const roleQuery = useQuery({
    queryKey: ["roles", domain, query.id],
    queryFn: () => fetchRoles({ organization_id: query.id }),
  })

  const organization = useQuery<Organization>({
    queryKey: [`organization-${query.id}`],
    queryFn: () => fetchOrganization(query.id),
  })

  const handleSave = () => {
    if (email && role) {
      addMutation.mutate()
    }
  }

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
      setHidden(organization.data.deleted_at !== null)
    }
  }, [organization.data])

  let contents
  if (organization.isPending) {
    contents = <Spinner variant={"medium"} />
  } else if (organization.isError) {
    contents = <ErrorBanner variant={"readOnly"} error={organization.error} />
  } else {
    contents = content(
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
      organization,
    )
  }

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
        {contents}
        <AddUserPopup
          show={showAddUserPopup}
          setShow={setShowAddUserPopup}
          email={email}
          setEmail={setEmail}
          role={role}
          setRole={setRole}
          handleSave={handleSave}
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
  updateOrgMutation: UseMutationResult<void, unknown, { name: string; hidden: boolean }, unknown>,
  organization: UseQueryResult<Organization>,
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
        font-family: "Inter", sans-serif;
        color: #1a2333;
        font-size: 24px;
        ${respondToOrLarger.lg} {
          padding: 40px 40px 0 40px;
        }
      `}
    >
      {t("link-manage-organization-with-name", { name: organization.data?.name ?? "" })}
    </div>

    <div
      className={css`
        display: flex;
        gap: 24px;
        margin: 20px 0 0 0px;
        border-bottom: 2px solid rgba(26, 35, 51, 0.2);
        font-family: "Inter", sans-serif;

        ${respondToOrLarger.lg} {
          margin: 40px 0 0 40px;
        }
      `}
    >
      <div
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

    {activeTab === "general"
      ? designContent(
          t,
          editMode,
          setEditMode,
          editedName,
          setEditedName,
          hidden,
          setHidden,
          updateOrgMutation,
        )
      : permissionContent(t, setShowAddUserPopup, users, handleDelete, handleEdit)}
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
  updateOrgMutation: UseMutationResult<void, unknown, { name: string; hidden: boolean }, unknown>,
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
          <span
            className={css`
              font-size: 14px;
              width: 80px;
              flex-shrink: 0;
            `}
          >
            {t("label-name")}
          </span>

          {editMode ? (
            <input
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
            </div>
          ) : (
            <span>{hidden ? t("visibility-false") : t("visibility-true")}</span>
          )}
        </div>

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
            `}
          >
            {t("text-field-label-or-header-slug-or-short-name")}
          </span>
        </div>

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
                onClick={() => updateOrgMutation.mutate({ name: editedName, hidden })}
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
                <button className={actionButtonStyle} onClick={() => handleEdit(user)}>
                  <PencilBox size={16} />
                </button>

                <button className={actionButtonStyle} onClick={() => handleDelete(user)}>
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

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ManageOrganization)),
)
