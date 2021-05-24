import { css } from "@emotion/css"
import styled from "@emotion/styled"
import sanitizeHtml from "sanitize-html"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import colorMapper from "../../styles/colorMapper"

interface PullquoteBlockAttributes {
  value: string
  citation: string
  className: string
  mainColor?: string
  customMainColor?: string
  textColor?: string
}

interface FigureAttributes {
  currentColor: string
  attributes: PullquoteBlockAttributes
}

const Figure = styled.figure<FigureAttributes>`
  background-color: ${(props) =>
    props.attributes.className === "is-style-solid-color" ? props.currentColor : null};
  border-bottom: 4px solid
    ${(props) => (props.attributes.className === "is-style-default" ? props.currentColor : null)};
  border-top: 4px solid
    ${(props) => (props.attributes.className === "is-style-default" ? props.currentColor : null)};
  margin-bottom: 1.75em;
`

const Blockquote = styled.blockquote<{ currentColor: string }>`
  color: ${(props) => props.currentColor};
  padding: 3em 0;
  text-align: center;
`

const PullquoteBlock: React.FC<BlockRendererProps<PullquoteBlockAttributes>> = ({ data }) => {
  const attributes: PullquoteBlockAttributes = data.attributes

  let mainColor = colorMapper(attributes.mainColor, "#FFFFFF")

  mainColor = attributes.customMainColor ?? "#FFFFFF"

  const textColor = colorMapper(attributes.textColor, "#000000")

  const value = attributes.value !== undefined ? attributes.value : "<p></p>"
  return (
    <Figure
      currentColor={mainColor}
      attributes={attributes}
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <Blockquote currentColor={textColor}>
        <div>
          <p
            className={css`
              font-size: 28px;
            `}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
          ></p>
        </div>
        <cite>{attributes.citation}</cite>
      </Blockquote>
    </Figure>
  )
}

export default PullquoteBlock
