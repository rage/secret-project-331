import { css } from "@emotion/css"

import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const Heading1: React.FC = ({ children }) => {
  return (
    <h1
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      {children}
    </h1>
  )
}

export default Heading1
