import { css } from "@emotion/css"
import styled from "@emotion/styled"
import sanitizeHtml from "sanitize-html"

import colorMapper from "../../styles/colorMapper"
import { PullquoteAttributes } from "../../types/GutenbergBlockAttributes"

interface FigureAttributes {
  currentColor: string
  solidColor: boolean
}

const Figure = styled.figure<FigureAttributes>`
  ${(props) =>
    props.solidColor === true
      ? `background-color: ${props.currentColor}`
      : `border-bottom: 4px solid ${props.currentColor}; border-top: 4px solid ${props.currentColor}; margin-bottom: 1.75em;`}
`

const Blockquote = styled.blockquote<{ currentColor: string }>`
  color: ${(props) => props.currentColor};
  padding: 3em 0;
  text-align: center;
`

const PullquoteBlock: React.FC<BlockRendererProps<PullquoteAttributes>> = ({ data }) => {
  const attributes: PullquoteAttributes = data.attributes

  let mainColor = colorMapper(attributes.mainColor, "#FFFFFF")

  mainColor = attributes.customMainColor ?? "#FFFFFF"

  const textColor = colorMapper(attributes.textColor, "#000000")
  const solidColor = attributes.className === "is-style-solid-color" ? true : false
  const value = attributes.value !== undefined ? attributes.value : "<p></p>"
  return (
    <Figure
      currentColor={mainColor}
      solidColor={solidColor}
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
        <cite dangerouslySetInnerHTML={{ __html: sanitizeHtml(attributes.citation) }}></cite>
      </Blockquote>
    </Figure>
  )
}

export default PullquoteBlock
