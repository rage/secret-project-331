import { css } from "@emotion/css"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { UserDetail } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import TextFieldWithIcon from "@/shared-module/common/components/InputFields/TextFieldWithIcon"
import Spinner from "@/shared-module/common/components/Spinner"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
import SearchIcon from "@/shared-module/common/img/search-icon.svg"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
type Props = {
  users?: UserDetail[]
  isLoading: boolean
  addUser: (user: UserDetail) => void
}

const UserSearch: React.FC<Props> = ({ users, addUser, isLoading }) => {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")

  const filteredUsers = (users || []).filter(
    (user) =>
      (user.first_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (user.last_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      user.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div
      className={css`
        padding-left: 0.4rem;
      `}
    >
      <div>
        <Button
          onClick={() => setIsModalOpen(true)}
          variant="primary"
          size={"small"}
          className={css`
            text-transform: capitalize !important;
          `}
        >
          {t("button-add-students")}
        </Button>
      </div>

      <StandardDialog
        onClose={() => setIsModalOpen(false)}
        title={t("button-add-students")}
        open={isModalOpen}
        leftAlignTitle={true}
        width={"wide"}
      >
        {isLoading ? (
          <Spinner variant="medium" />
        ) : (
          <div>
            <div
              className={css`
                font-weight: ${fontWeights.medium};
                font-size: ${baseTheme.fontSizes[1]}px;
                font-family: ${headingFont};
              `}
            >
              {t("label-list-of-all-students")}
            </div>

            <TextFieldWithIcon
              type="text"
              placeholder={t("placeholder-search-users")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={css`
                margin-top: 1rem;
                margin-bottom: 2rem;
                width: 45%;
              `}
              icon={<SearchIcon />}
            />
            <div>
              <table
                className={css`
                  border-collapse: collapse;
                  width: 100%;
                  td,
                  th {
                    white-space: nowrap;
                    height: 60px;
                    padding-left: 2rem;
                    padding-top: 1rem;
                    padding-bottom: 1rem;

                    text-align: left;
                    color: ${baseTheme.colors.gray[700]};
                    font-size: ${baseTheme.fontSizes[0]}px;
                    opacity: 0.8;
                  }
                  tr {
                    border-bottom: 1.5px solid #ced1d7;
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
                  {(searchTerm.trim() ? filteredUsers : users || []).map((user) => (
                    <tr key={user.user_id}>
                      <td>
                        {user.first_name} {user.last_name}
                      </td>
                      <td>{user.email}</td>
                      <td>{user.user_id}</td>
                      <td>
                        <Button
                          onClick={() => addUser(user)}
                          variant={"secondary"}
                          size={"small"}
                          data-testid={`add-user-button-${user.user_id}`}
                          className={css`
                            text-transform: capitalize !important;
                          `}
                        >
                          {t("button-add")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {searchTerm.trim() && filteredUsers.length === 0 && <p>{t("label-no-users-found")}</p>}
          </div>
        )}
      </StandardDialog>
    </div>
  )
}

export default UserSearch
