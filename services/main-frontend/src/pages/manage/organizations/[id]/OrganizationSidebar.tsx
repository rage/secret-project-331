import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

const OrganizationSidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true)
  const { t } = useTranslation()

  return (
    <div
      className={css`
        position: absolute;
        top: 59px;
        left: 0;
        width: ${isOpen ? "170px" : "30px"};
        background: #fff;
        border-right: 2px solid rgba(26, 35, 51, 0.2);
        height: 100vh;
        transition: width 0.3s ease;
      `}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={css`
          position: absolute;
          top: 27px;
          right: -12px;
          width: 23px;
          height: 23px;
          border: 1px solid #afafaf;
          background: #fff;
          font-size: 14px;
          line-height: 0;
          cursor: pointer;
        `}
      >
        {isOpen ? "<" : ">"}
      </button>

      {isOpen && (
        <div
          className={css`
            padding: 1rem;
            font-family: Inter;
            font-size: 14px;
            color: #1a2333;
          `}
        >
          <div
            className={css`
              font-size: 12px;
              font-weight: 500;
              margin-bottom: 1rem;
            `}
          >
            ORGANIZATION
          </div>
          <div className={menuItemStyle}>{t("sidebar-courses", { defaultValue: "Courses" })}</div>
          <div className={menuItemStyle}>{t("sidebar-exam", { defaultValue: "Exam" })}</div>
          <div className={menuItemStyle}>
            {t("sidebar-manage-org", { defaultValue: "Manage org" })}
          </div>
        </div>
      )}
    </div>
  )
}

const menuItemStyle = css`
  background: #e5e8ed;
  padding: 8px 12px;
  border-radius: 2px;
  margin-bottom: 0.75rem;
  font-weight: 400;
  cursor: pointer;
`

export default OrganizationSidebar
