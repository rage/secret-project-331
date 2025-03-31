import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { secondaryFont } from "@/shared-module/common/styles"

export interface DashboardItem {
  id: string
  name: string
  value: string
}

export interface ChapterPointDashboardProps {
  chapterScores: DashboardItem[]
  title: string
  userCount: number
}

const ChapterPointsDashboard: React.FC<ChapterPointDashboardProps> = ({
  chapterScores,
  title,
  userCount,
}) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        padding: 2rem;
      `}
    >
      <div
        className={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        `}
      >
        <h3
          className={css`
            margin: 0;
            font-size: 1.4rem;
            color: #2c3e50;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          `}
        >
          {title}
        </h3>
        <div
          className={css`
            font-size: 1.1rem;
            color: #6c757d;
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
              background: #f8f9fa;
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
                  color: #6c757d;
                  margin-bottom: 0.5rem;
                `}
              >
                {c.name}
              </div>
              <div
                className={css`
                  font-size: 1.8rem;
                  font-weight: 600;
                  color: #2c3e50;
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
