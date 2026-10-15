"use client"

import { css } from "@emotion/css"
import { useMemo, useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { UserDetail } from "@/generated/api/types.generated"
import SearchIcon from "@/shared-module/common/img/search-icon.svg"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
import { Button, Dialog, LoadingRegion, Table, TextField } from "@/shared-module/components"

interface Props {
  users?: UserDetail[]
  isLoading: boolean
  addUser: (user: UserDetail) => void
  removeUser: (userId: string) => void
  selectedUsers: UserDetail[]
}

const UserSearch: React.FC<Props> = ({ users, addUser, removeUser, selectedUsers, isLoading }) => {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { control, watch } = useForm<{ searchTerm: string }>({
    defaultValues: { searchTerm: "" },
  })
  const searchTerm = watch("searchTerm")

  const isAdded = (user: UserDetail) => selectedUsers.some((u) => u.user_id === user.user_id)

  const handleAddUser = (user: UserDetail) => {
    addUser(user)
  }

  const handleRemoveUser = (user: UserDetail) => {
    removeUser(user.user_id)
  }

  const filteredUsers = useMemo(() => {
    const lowerCasedSearch = searchTerm.toLowerCase()

    return (users || []).filter((user) => {
      const firstName = user.first_name?.toLowerCase() ?? ""
      const lastName = user.last_name?.toLowerCase() ?? ""
      const userId = user.user_id?.toLowerCase() ?? ""
      const email = user.email?.toLowerCase() ?? ""

      return (
        firstName.includes(lowerCasedSearch) ||
        lastName.includes(lowerCasedSearch) ||
        userId.includes(lowerCasedSearch) ||
        email.includes(lowerCasedSearch)
      )
    })
  }, [searchTerm, users])

  return (
    <div
      className={css`
        padding-left: 0.4rem;
      `}
    >
      <div>
        <Button onClick={() => setIsModalOpen(true)} variant="primary" size={"small"}>
          {t("button-add-students")}
        </Button>
      </div>

      <Dialog
        onClose={() => setIsModalOpen(false)}
        title={t("button-add-students")}
        open={isModalOpen}
        size="wide"
      >
        {isLoading ? (
          <LoadingRegion />
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

            <TextField
              name="searchTerm"
              control={control}
              label={t("label-search-students")}
              className={css`
                margin-top: 1rem;
                margin-bottom: 2rem;
                width: 45%;
              `}
              iconStart={<SearchIcon />}
            />
            <div>
              <Table
                caption={t("label-list-of-all-students")}
                emptyState={null}
                rows={searchTerm.trim() ? filteredUsers : users || []}
                rowKey={(user) => user.user_id}
                columns={[
                  {
                    header: t("text-field-label-name"),
                    cell: (user) => `${user.first_name ?? ""} ${user.last_name ?? ""}`,
                  },
                  { header: t("label-email"), cell: (user) => user.email },
                  { header: t("label-user-id"), cell: (user) => user.user_id },
                  {
                    header: <VisuallyHidden>{t("button-add")}</VisuallyHidden>,
                    cell: (user) => (
                      <Button
                        onClick={() =>
                          isAdded(user) ? handleRemoveUser(user) : handleAddUser(user)
                        }
                        variant={"secondary"}
                        size={"small"}
                        data-testid={`add-user-button-${user.user_id}`}
                      >
                        {t(isAdded(user) ? "button-remove" : "button-add")}
                      </Button>
                    ),
                  },
                ]}
              />
            </div>

            {searchTerm.trim() && filteredUsers.length === 0 && <p>{t("label-no-users-found")}</p>}
          </div>
        )}
      </Dialog>
    </div>
  )
}

export default UserSearch
