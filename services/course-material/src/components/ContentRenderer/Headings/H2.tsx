import { css } from "@emotion/css"
import styled from "@emotion/styled"

import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

const H1 = styled.h2`
  color: red;
  font-size: clamp(40px, 4vw, 60px);
`

const Heading2: React.FC = ({ children }) => {
  return (
    <H1
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      {children}
    </H1>
  )
}

export default Heading2
