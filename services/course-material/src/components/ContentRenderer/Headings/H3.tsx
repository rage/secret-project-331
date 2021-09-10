import { css } from "@emotion/css"

import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const Heading3: React.FC = ({ children }) => {
  return (
    <h3
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      {children}
    </h3>
  )
}

export default Heading3
