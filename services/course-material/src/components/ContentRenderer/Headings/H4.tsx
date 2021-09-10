import { css } from "@emotion/css"

import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const Heading4: React.FC = ({ children }) => {
  return (
    <h4
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      {children}
    </h4>
  )
}

export default Heading4
