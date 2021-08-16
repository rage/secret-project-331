import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const Heading2: React.FC = ({ children }) => {
  return (
    <h2
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      {children}
    </h2>
  )
}

export default Heading2
