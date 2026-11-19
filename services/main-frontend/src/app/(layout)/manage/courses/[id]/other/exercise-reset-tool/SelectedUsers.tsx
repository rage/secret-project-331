"use client"

import { css } from "@emotion/css"
import { XmarkCircle } from "@vectopus/atlas-icons-react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import type { UserDetail } from "@/generated/api/types.generated"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { Button, Table } from "@/shared-module/components"

import UserSearch from "./UserSearch"

interface Props {
  selectedUsers: UserDetail[]
  removeUser: (userId: string) => void
  users?: UserDetail[]
  isLoading: boolean
  addUser: (user: UserDetail) => void
}

const SelectedUsers: React.FC<Props> = ({
  selectedUsers,
  removeUser,
  users,
  addUser,
  isLoading,
}) => {
  const { t } = useTranslation()

  return (
    <div>
      <div
        className={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 10px;
        `}
      >
        <p
          className={css`
            font-size: ${baseTheme.fontSizes[1]}px;
            font-weight: ${fontWeights.semibold};
            color: ${baseTheme.colors.gray[700]};
          `}
        >
          {t("label-selected-users")}
        </p>
        <UserSearch
          isLoading={isLoading}
          addUser={addUser}
          removeUser={removeUser}
          selectedUsers={selectedUsers}
          {...omitUndefined({ users })}
        />
      </div>
      <div
        className={css`
          padding-bottom: 25px;
          font-weight: ${fontWeights.normal};
          color: ${baseTheme.colors.gray[700]};
          font-size: ${baseTheme.fontSizes[0]}px;
        `}
      >
        {selectedUsers.length === 0 ? (
          <div
            className={css`
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              height: 74px;
              border-radius: 2px;
              background: #f2f3f5;
            `}
          >
            <XmarkCircle />
            <p>{t("label-no-users-selected")}</p>
          </div>
        ) : (
          <Table
            caption={t("label-selected-users")}
            rows={selectedUsers}
            rowKey={(user) => user.user_id}
            columns={[
              {
                header: t("text-field-label-name"),
                cell: (user) => `${user.first_name ?? ""} ${user.last_name ?? ""}`,
              },
              { header: t("label-email"), cell: (user) => user.email },
              { header: t("label-user-id"), cell: (user) => user.user_id },
              {
                header: <VisuallyHidden>{t("button-remove")}</VisuallyHidden>,
                cell: (user) => (
                  <Button
                    onClick={() => removeUser(user.user_id)}
                    variant={"secondary"}
                    size={"small"}
                  >
                    {t("button-remove")}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  )
}

export default SelectedUsers
