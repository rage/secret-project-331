import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import styled from "@emotion/styled"

const H1 = styled.h1`
  font-size: clamp(40px, 4vw, 60px);
  color: ${(prop: any) => (prop.textColor ? "green" : "black")} !important;
`

interface HeadingBlockAttributes {
  level: string
  content: string
  textColor: string
}

const HeadingBlock: React.FC<BlockRendererProps<HeadingBlockAttributes>> = ({ data }) => {
  const attributes: HeadingBlockAttributes = data.attributes
  return (
    <H1
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
      color={attributes.textColor}
    >
      {attributes.content}
    </H1>
  )
}

export default HeadingBlock

/* This is a conditional Render for Heading [Work-in-progress]*/

/* const HeadingBlock: React.FC<BlockRendererProps<HeadingBlockAttributes>> = ({ data }) => {
    const attributes: HeadingBlockAttributes = data.attributesc
      switch (attributes.level) {
        case 1:
          return <H1>{attributes.content}</H1>
        case 2:
          return <H2>{attributes.content}</H2>
        case 3:
          return <H3>{attributes.content}</H3>
      }   
}

export default HeadingBlock */
