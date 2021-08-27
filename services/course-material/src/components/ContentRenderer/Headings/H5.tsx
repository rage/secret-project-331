import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const Heading5: React.FC = ({ children }) => {
  return (
    <h5
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      {children}
    </h5>
  )
}

export default Heading5
