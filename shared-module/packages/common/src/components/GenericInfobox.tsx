import { css } from "@emotion/css"
import { InfoCircle } from "@vectopus/atlas-icons-react"

import { baseTheme } from "../styles"

const GenericInfobox: React.FC<React.PropsWithChildren<React.PropsWithChildren<unknown>>> = ({
  children,
}) => {
  return (
    <div
      className={css`
        padding: 0.7rem 1rem;
        border: 2px solid ${baseTheme.colors.blue[400]};
        border-radius: 8px;
        display: flex;
        align-items: center;
      `}
    >
      <InfoCircle
        className={css`
          color: ${baseTheme.colors.blue[500]};
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
