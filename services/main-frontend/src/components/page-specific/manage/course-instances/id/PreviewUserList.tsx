import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { ManualCompletionPreviewUser } from "../../../../../shared-module/bindings"

export interface PreviewUserListProps {
  users: Array<ManualCompletionPreviewUser>
}

const PreviewUserList: React.FC<PreviewUserListProps> = ({ users }) => {
  const { t } = useTranslation()

  const mapGradeToText = (grade: number | null, passed: boolean): string => {
    if (grade !== null) {
      return grade.toString()
    } else {
      return passed ? t("column-passed") : t("column-failed")
    }
  }

  return (
    <ul
      className={css`
        list-style-position: outside;
        list-style-type: none;
        margin: 0.5rem 0;
      `}
    >
      {users.map((user) => (
        <li
          key={user.user_id}
          className={css`
            padding: 0;
          `}
        >
          {user.user_id} ({user.first_name} {user.last_name},{" "}
          {mapGradeToText(user.grade, user.passed)})
        </li>
      ))}
    </ul>
  )
}

export default PreviewUserList
