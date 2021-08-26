import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const Heading6: React.FC = ({ children }) => {
  return (
    <h6
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      {children}
    </h6>
  )
}

export default Heading6
