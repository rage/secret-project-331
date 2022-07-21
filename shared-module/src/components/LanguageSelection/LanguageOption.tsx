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
      className={css`
        text-decoration: none;
        list-style: none;
        margin: 0;
        background: ${baseTheme.colors.clear[200]};
        border-bottom: 2px solid #e1e1e1;
        padding: 0.7rem 1rem;
        min-width: 10rem;
      `}
    >
      <Button
        className={css`
          text-decoration: none;
          list-style: none;
          margin: 0;
          padding: 0;
          font-size: 16px;
          background: inherit;
          color: ${baseTheme.colors.green[500]};
          border: none;

          :hover {
            background: inherit;
            color: ${baseTheme.colors.green[700]};
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
