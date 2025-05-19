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
          top: 60px;
          right: -12px;
          width: 24px;
          height: 24px;
          border: 1px solid #afafaf;
          border-radius: 50%;
          background: #fff;
          font-size: 14px;
          line-height: 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
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
  height: 36px;
  background: #e5e8ed;
  border-radius: 2px 2px 0 0;
  display: flex;
  align-items: center;
  padding-left: 12px;
  font-family: Inter;
  font-size: 14px;
  color: #1a2333;
  cursor: pointer;

  &:not(:last-child) {
    border-bottom: 1px solid #e5e8ed;
  }
`

export default OrganizationSidebar
