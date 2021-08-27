import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const Heading4: React.FC = ({ children }) => {
  return (
    <h4
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      {children}
    </h4>
  )
}

export default Heading4
