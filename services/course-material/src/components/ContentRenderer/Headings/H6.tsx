import { css } from "@emotion/css"

import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const Heading6: React.FC = ({ children }) => {
  return (
    <h6
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      {children}
    </h6>
  )
}

export default Heading6
