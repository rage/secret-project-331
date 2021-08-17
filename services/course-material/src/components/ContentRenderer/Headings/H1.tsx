import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const Heading1: React.FC = ({ children }) => {
  return (
    <h1
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      {children}
    </h1>
  )
}

export default Heading1
