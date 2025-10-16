import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "../../styles"
import Button from "../Button"

export interface LanguageOptionProps {
  label: string
  onClick: () => void
  isActive?: boolean
}

const LanguageOption: React.FC<LanguageOptionProps> = ({ label, onClick, isActive = false }) => {
  return (
    <li
      // I don't know what causes it, but !important is required here for some pages (like
      // organization courses page) but not others for some reason.
      className={css`
        text-decoration: none !important;
        list-style: none !important;
        margin: 0 !important;
        background: #fff;

        min-width: 10rem !important;
        border-width: 0 0 2px !important;
        border-style: solid !important;
        border-color: #e1e1e1 !important;
      `}
    >
      <Button
        className={css`
          text-decoration: none !important;
          text-transform: capitalize;
          list-style: none !important;
          margin: 0 !important;
          padding: 0.7rem 1rem !important;
          font-size: 16px !important;
          background: ${isActive ? baseTheme.colors.green[100] : "#fff"} !important;
          color: ${isActive ? baseTheme.colors.green[600] : baseTheme.colors.green[500]} !important;
          border: 0 !important;
          width: 100%;
          text-align: left;
          font-weight: ${isActive ? "600" : "normal"} !important;

          :hover {
            color: ${baseTheme.colors.green[700]};
            filter: brightness(92%) contrast(110%);
          }

          :focus-visible {
            outline: 2px solid ${baseTheme.colors.green[500]};
            outline-offset: -2px;
          }
        `}
        variant="primary"
        size="small"
        onClick={onClick}
      >
        {label}
      </Button>
    </li>
  )
}

export default LanguageOption
