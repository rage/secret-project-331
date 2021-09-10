import { css } from "@emotion/css"

import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const Heading5: React.FC = ({ children }) => {
  return (
    <h5
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      {children}
    </h5>
  )
}

export default Heading5
