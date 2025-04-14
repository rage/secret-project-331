import { css } from "@emotion/css"
import { XmarkCircle } from "@vectopus/atlas-icons-react"
import { useTranslation } from "react-i18next"

import UserSearch from "./UserSearch"

import { UserDetail } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"

type Props = {
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
          users={users}
          isLoading={isLoading}
          addUser={addUser}
          removeUser={removeUser}
          selectedUsers={selectedUsers}
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
          <table
            className={css`
              border-collapse: collapse;
              margin-bottom: 1.5rem;

              width: 100%;

              td,
              th {
                padding-left: 28px;
                text-align: left;
                height: 60px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                opacity: 0.8;
              }
              td {
                border-top: 1px solid #ced1d7;
              }
              th {
                font-weight: ${fontWeights.medium};
              }
            `}
          >
            <thead>
              <tr>
                <th>{t("text-field-label-name")}</th>
                <th>{t("label-email")}</th>
                <th>{t("label-user-id")}</th>
              </tr>
            </thead>
            <tbody>
              {selectedUsers.map((user) => (
                <tr key={user.user_id}>
                  <td>
                    {user.first_name} {user.last_name}
                  </td>
                  <td>{user.email}</td>
                  <td>{user.user_id}</td>
                  <td>
                    <Button
                      onClick={() => removeUser(user.user_id)}
                      variant={"secondary"}
                      size={"small"}
                      transform={"capitalize"}
                    >
                      {t("button-remove")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default SelectedUsers
