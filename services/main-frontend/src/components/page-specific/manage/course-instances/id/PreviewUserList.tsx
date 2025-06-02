import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { ManualCompletionPreviewUser } from "@/shared-module/common/bindings"
import { baseTheme } from "@/shared-module/common/styles"

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
    <div
      className={css`
        padding: 1rem;
        background-color: ${baseTheme.colors.clear[100]};
        border-radius: 8px;
      `}
    >
      <ul
        className={css`
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        `}
      >
        {users.map((user) => (
          <li
            key={user.user_id}
            className={css`
              padding: 0.75rem 1rem;
              background-color: ${baseTheme.colors.primary[100]};
              border-radius: 6px;
              border: 1px solid ${baseTheme.colors.clear[300]};
              display: flex;
              align-items: center;
              transition: all 0.2s ease;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

              &:hover {
                background-color: ${baseTheme.colors.clear[100]};
                transform: translateX(4px);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              }
            `}
          >
            <div
              className={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
              `}
            >
              <span
                className={css`
                  font-weight: 500;
                  color: ${baseTheme.colors.gray[700]};
                `}
              >
                {user.first_name} {user.last_name}
              </span>
              <span
                className={css`
                  font-size: 14px;
                  color: ${baseTheme.colors.gray[500]};
                  padding-left: 0.5rem;
                  border-left: 1px solid ${baseTheme.colors.clear[300]};
                `}
              >
                {t("user-id")}: {user.user_id}
              </span>
            </div>
            <div
              className={css`
                margin-left: auto;
                padding: 0.25rem 0.75rem;
                background-color: ${user.passed
                  ? baseTheme.colors.green[100]
                  : baseTheme.colors.red[100]};
                color: ${user.passed ? baseTheme.colors.green[600] : baseTheme.colors.red[600]};
                border-radius: 4px;
                font-weight: 500;
                border: 1px solid
                  ${user.passed ? baseTheme.colors.green[200] : baseTheme.colors.red[200]};
              `}
            >
              {mapGradeToText(user.grade, user.passed)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default PreviewUserList
