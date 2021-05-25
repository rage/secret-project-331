import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { BlockRendererProps } from "."
import sanitizeHtml from "sanitize-html"
import colorMapper from "../../styles/colorMapper"
import fontSizeMapper from "../../styles/fontSizeMapper"
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

interface CoverTextPosition {
  justifyContent: string
  alignItems: string
}

const textPosition: {
  [contentPosition: string]: CoverTextPosition | { alignItems: "center"; justifyContent: "center" }
} = {
  "top left": { alignItems: "flex-start", justifyContent: "flex-start" },
  "top center": { alignItems: "flex-start", justifyContent: "center" },
  "top right": { alignItems: "flex-start", justifyContent: "flex-end" },
  "center left": { alignItems: "center", justifyContent: "flex-start" },
  "center right": { alignItems: "center", justifyContent: "flex-end" },
  "bottom left": { alignItems: "flex-end", justifyContent: "flex-start" },
  "bottom center": { alignItems: "flex-end", justifyContent: "center" },
  "bottom right": { alignItems: "flex-end", justifyContent: "flex-end" },
}

const LayoutContainer = styled.div<LayoutContainerAttributes>`
  display: flex;
  justify-content: ${(props) => props.contentPosition.justifyContent};
  align-items: ${(props) => props.contentPosition.alignItems};
  background-color: ${(props) => props.backgroundColor};
  color: ${(props) => props.textColor};
  font-size: ${(props) => props.fontSize};
  overflow-wrap: break-word;
  background-size: cover;
  background-position: center center;
  min-height: 430px;
  padding: 1em;
`

const ImageContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  overflow-wrap: break-word;
  background-size: cover;
  background-position: center center;
  min-height: 430px;
  padding: 1em;
`

interface CoverBlockAttributes {
  content: string
  overlayColor: string
  backgroundType: boolean
  dimRatio: number
  hasParallax: boolean
  isRepeated: boolean
  contentPosition: string
}

interface LayoutContainerAttributes {
  backgroundColor: string
  backgroundType: boolean
  dimRatio: number
  hasParallax: boolean
  isRepeated: boolean
  contentPosition: CoverTextPosition
  textColor: string
  fontSize: string
}

interface InnerBlockAttributes {
  align: string
  content: string
  dropCap: boolean
  fontSize: string
  textColor: string
}

const CoverBlock: React.FC<BlockRendererProps<CoverBlockAttributes>> = ({ data }) => {
  const attributes: CoverBlockAttributes = data.attributes
  const innerBlocks: InnerBlockAttributes = data.innerBlocks[0].attributes

  const backgroundColor = colorMapper(attributes.overlayColor, "unset")
  const textColor = colorMapper(innerBlocks.textColor, "#000000")
  const fontSize = fontSizeMapper(innerBlocks.fontSize)
  const contentPosition = textPosition[attributes.contentPosition]
  console.log(data)
  return (
    <pre
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <LayoutContainer
        backgroundType={attributes.backgroundType}
        dimRatio={attributes.dimRatio}
        hasParallax={attributes.hasParallax}
        isRepeated={attributes.isRepeated}
        backgroundColor={backgroundColor}
        contentPosition={contentPosition}
        textColor={textColor}
        fontSize={fontSize}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(innerBlocks.content) }}
      ></LayoutContainer>
    </pre>
  )
}

export default CoverBlock
