import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import styled from "@emotion/styled"
import colorMapper from "../../styles/colorMapper"
import fontSizeMapper from "../../styles/fontSizeMapper"

interface PreformatterBlockAttributes {
  content: string
  gradient?: string
  backgroundColor?: string
  textColor?: string
  fontSize?: string
}

const Pre = styled.pre`
  background: ${(props) =>
    props.attributes.gradient !== undefined
      ? chooseColor(props.attributes.gradient)
      : chooseColor(props.attributes.backgroundColor)};
  padding: 1.25em 2.375em;
`

const Blockquote = styled.blockquote`
  color: ${(props) => props.currentColor};
  text-align: center;
`
const chooseColor = (color) => {
  if (color === undefined) {
    return "#FFFFFF"
  }
  const backgroundColor = colorMapper(color)
  return backgroundColor
}

const PreformatterBlock: React.FC<BlockRendererProps<PreformatterBlockAttributes>> = ({ data }) => {
  const attributes: PreformatterBlockAttributes = data.attributes

  const textColor =
    attributes.textColor !== undefined ? colorMapper(attributes.textColor) : "#000000"

  const fontSize = fontSizeMapper(attributes.fontSize)

  return (
    <Pre
      attributes={attributes}
      className={css`
        ${normalWidthCenteredComponentStyles}
        color: ${textColor};
        font-size: ${fontSize};
        white-space: pre-line;
      `}
    >
      <div style={{ overflowWrap: "break-word" }}> {attributes.content} </div>
    </Pre>
  )
}

export default PreformatterBlock
