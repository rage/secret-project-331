import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "../../styles"
import Button from "../Button"

export interface LanguageOptionProps {
  label: string
  onClick: () => void
}

const LanguageOption: React.FC<LanguageOptionProps> = ({ label, onClick }) => {
  return (
    <li
      // I don't know what causes it, but !important is required here for some pages (like
      // organization courses page) but not others for some reason.
      className={css`
        text-decoration: none !important;
        list-style: none !important;
        margin: 0 !important;
        background: ${baseTheme.colors.clear[200]} !important;
        padding: 0.7rem 1rem !important;
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
          padding: 0 !important;
          font-size: 16px !important;
          background: ${baseTheme.colors.clear[200]} !important;
          color: ${baseTheme.colors.green[500]} !important;
          border: 0 !important;

          :hover {
            color: ${baseTheme.colors.green[700]} !imporant;
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
