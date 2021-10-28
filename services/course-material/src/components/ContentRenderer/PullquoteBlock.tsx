import { css } from "@emotion/css"
import styled from "@emotion/styled"
import sanitizeHtml from "sanitize-html"

import { PullquoteAttributes } from "../../../types/GutenbergBlockAttributes"
import { courseMaterialCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import colorMapper from "../../styles/colorMapper"

import { BlockRendererProps } from "."

const Figure = styled.figure<{
  backgroundColor: string
  solidColor: boolean
}>`
  ${(props) =>
    props.solidColor === true
      ? // eslint-disable-next-line i18next/no-literal-string
        `background-color: ${props.backgroundColor}`
      : // eslint-disable-next-line i18next/no-literal-string
        `border-bottom: 4px solid ${props.backgroundColor};
         border-top: 4px solid ${props.backgroundColor};
         margin-bottom: 1.75em;`}
`

// eslint-disable-next-line i18next/no-literal-string
const Blockquote = styled.blockquote<{ textColor: string }>`
  color: ${(props) => props.textColor};
  padding: 3em 0;
  text-align: center;
`

const PullquoteBlock: React.FC<BlockRendererProps<PullquoteAttributes>> = ({ data }) => {
  const attributes: PullquoteAttributes = data.attributes

  // eslint-disable-next-line i18next/no-literal-string
  const backgroundColor = colorMapper(attributes.backgroundColor, "#FFFFFF")

  const textColor = colorMapper(attributes.textColor, "#000000")
  const solidColor = attributes.className === "is-style-solid-color" ? true : false
  // eslint-disable-next-line i18next/no-literal-string
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
