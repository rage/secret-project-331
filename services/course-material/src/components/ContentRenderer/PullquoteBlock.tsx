import { css } from "@emotion/css"
import styled from "@emotion/styled"
import sanitizeHtml from "sanitize-html"

import { courseMaterialCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import colorMapper from "../../styles/colorMapper"
import { PullquoteAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

const Figure = styled.figure<{
  backgroundColor: string
  solidColor: boolean
}>`
  ${(props) =>
    props.solidColor === true
      ? `background-color: ${props.backgroundColor}`
      : `border-bottom: 4px solid ${props.backgroundColor};
         border-top: 4px solid ${props.backgroundColor};
         margin-bottom: 1.75em;`}
`

const Blockquote = styled.blockquote<{ textColor: string }>`
  color: ${(props) => props.textColor};
  padding: 3em 0;
  text-align: center;
`

const PullquoteBlock: React.FC<BlockRendererProps<PullquoteAttributes>> = ({ data }) => {
  const attributes: PullquoteAttributes = data.attributes

  const backgroundColor = colorMapper(attributes.backgroundColor, "#FFFFFF")

  const textColor = colorMapper(attributes.textColor, "#000000")
  const solidColor = attributes.className === "is-style-solid-color" ? true : false
  const value = attributes.value !== undefined ? attributes.value : "<p></p>"
  return (
    <Figure
      backgroundColor={backgroundColor}
      solidColor={solidColor}
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      <Blockquote textColor={textColor}>
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
