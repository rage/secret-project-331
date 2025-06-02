import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, secondaryFont } from "@/shared-module/common/styles"

export interface DashboardItem {
  id: string
  name: string
  value: string
}

export interface ChapterPointDashboardProps {
  chapterScores: DashboardItem[]
  userCount: number
}

const ChapterPointsDashboard: React.FC<ChapterPointDashboardProps> = ({
  chapterScores,
  userCount,
}) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        background: ${baseTheme.colors.primary[100]};
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        padding: 2rem;
      `}
    >
      <div
        className={css`
          display: flex;
          justify-content: flex-end;
          align-items: center;
          margin-bottom: 2rem;
        `}
      >
        <div
          className={css`
            font-size: 1.1rem;
            color: ${baseTheme.colors.gray[500]};
            text-transform: capitalize;
          `}
        >
          {t("number-of-students")}: {userCount}
        </div>
      </div>

      <div
        className={css`
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          justify-content: center;
          max-width: 1200px;
          margin: 0 auto;
        `}
      >
        {chapterScores.map((c) => (
          <div
            className={css`
              background: ${baseTheme.colors.clear[100]};
              border-radius: 8px;
              padding: 1.5rem;
              display: flex;
              align-items: center;
            `}
            key={c.id}
          >
            <div>
              <div
                className={css`
                  font-size: 0.9rem;
                  color: ${baseTheme.colors.gray[500]};
                  margin-bottom: 0.5rem;
                `}
              >
                {c.name}
              </div>
              <div
                className={css`
                  font-size: 1.8rem;
                  font-weight: 600;
                  color: ${baseTheme.colors.gray[700]};
                  font-family: ${secondaryFont};
                `}
              >
                {c.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ChapterPointsDashboard
