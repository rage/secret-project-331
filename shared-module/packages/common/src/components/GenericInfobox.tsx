"use client"

import { css } from "@emotion/css"
import { InfoCircle } from "@vectopus/atlas-icons-react"

import { baseTheme } from "../styles"

const GenericInfobox: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div
      className={css`
        padding: 0.875rem 1rem;
        border: 1px solid ${baseTheme.colors.blue[200]};
        border-radius: 8px;
        background: ${baseTheme.colors.blue[50]};
        display: flex;
        align-items: flex-start;

        overflow-x: auto;
      `}
    >
      <InfoCircle
        className={css`
          color: ${baseTheme.colors.blue[500]};
          flex: none;
          margin-right: 0.5rem;
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

export default GenericInfobox
