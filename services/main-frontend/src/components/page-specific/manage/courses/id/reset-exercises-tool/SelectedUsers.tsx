import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { UserDetail } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"

type Props = {
  selectedUsers: UserDetail[]
  removeUser: (userId: string) => void
}

const SelectedUsers: React.FC<Props> = ({ selectedUsers, removeUser }) => {
  const { t } = useTranslation()

  return (
    <div>
      <h2>{t("label-selected-users")}</h2>
      <div
        className={css`
          padding-left: 0.4rem;
        `}
      >
        {selectedUsers.length === 0 ? (
          <p>{t("label-no-users-selected")}</p>
        ) : (
          <table
            className={css`
              border-collapse: collapse;
              margin-top: 1.5rem;
              width: 100%;

              td,
              th {
                padding-left: 20px;
                text-align: left;
                height: 60px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              tr {
                border-bottom: 1.5px solid #0000001a;
                font-size: ${baseTheme.fontSizes[18]};
              }
            `}
          >
            <thead>
              <tr
                className={css`
                  font-family: ${headingFont};
                  font-weight: ${fontWeights.semibold};
                  font-size: ${baseTheme.fontSizes[18]};
                  color: ${baseTheme.colors.gray[400]};
                `}
              >
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
                      variant={"reject"}
                      size={"small"}
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
