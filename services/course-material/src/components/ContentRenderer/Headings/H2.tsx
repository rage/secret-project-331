import { css } from "@emotion/css"

import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const Heading2: React.FC = ({ children }) => {
  return (
    <h2
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      {children}
    </h2>
  )
}

export default Heading2
