import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import styled from "@emotion/styled"

const H1 = styled.h1`
  color: red;
  font-size: clamp(40px, 4vw, 60px);
`

const Heading1 = ({ children }) => {
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

export default Heading1
