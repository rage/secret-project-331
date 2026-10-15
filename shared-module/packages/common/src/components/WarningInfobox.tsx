"use client"

import { css } from "@emotion/css"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"

import { baseTheme } from "../styles"

const WarningInfobox: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div
      className={css`
        padding: 0.7rem 1rem;
        border: 2px solid ${baseTheme.colors.yellow[700]};
        background-color: ${baseTheme.colors.yellow[100]};
        border-radius: 8px;
        display: flex;
        align-items: center;

        overflow-x: auto;
      `}
    >
      <ExclamationTriangle
        className={css`
          color: ${baseTheme.colors.yellow[800]};
          margin-right: 0.5rem;
          flex-shrink: 0;
        `}
      />
      <div
        className={css`
          flex: 1;
        `}
      >
        {children}
      </div>
    </div>
  )
}

export default WarningInfobox
