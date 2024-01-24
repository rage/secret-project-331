import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

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
        margin-top: 51px;
        margin-bottom: 67px;
        padding: 44px 57px 49px 57px;

        background: #ffffff;
        border: 1px solid rgba(190, 190, 190, 0.6);
      `}
    >
      <h3
        className={css`
          text-transform: uppercase;
        `}
      >
        {title}
      </h3>
      <div
        className={css`
          margin-top: 22px;

          font-size: 22px;
          line-height: 22px;
          text-transform: capitalize;
        `}
      >
        {t("number-of-students")}: {userCount}
      </div>
      <div
        className={css`
          column-gap: 36px;
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
        `}
      >
        {chapterScores.map((c) => (
          <div
            className={css`
              margin-top: 26px;
              padding: 20px 24px;

              display: flex;
              flex-direction: row;
              border: 1.5px solid rgba(190, 190, 190, 0.5);
              width: 347px;
            `}
            key={c.id}
          >
            <div
              className={css`
                height: 66px;
                width: 66px;
                background: #e6f4fb;
                border-radius: 50%;
              `}
            ></div>
            <div
              className={css`
                display: flex;
                flex-direction: column;
                justify-content: center;
                margin-left: 20px;
              `}
            >
              {c.name}
              <div
                className={css`
                  font-size: 30px;
                  line-height: 30px;
                  padding-top: 8px;
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
