import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const Heading3: React.FC = ({ children }) => {
  return (
    <h3
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      {children}
    </h3>
  )
}

export default Heading3
