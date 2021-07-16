import { css } from "@emotion/css"
import styled from "@emotion/styled"

import colorMapper from "../../styles/colorMapper"
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import { CoverAttributes } from "../../types/GutenbergBlockAttributes"

import ContentRenderer, { BlockRendererProps } from "."

interface CoverTextPosition {
  justifyContent: string
  alignItems: string
}

const textPosition: {
  [contentPosition: string]: CoverTextPosition
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
  background-color: ${(props) => props.overlayColor};
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

interface LayoutContainerAttributes {
  overlayColor: string
  backgroundType: boolean
  dimRatio: number
  hasParallax: boolean
  isRepeated: boolean
  contentPosition: CoverTextPosition
}

const CoverBlock: React.FC<BlockRendererProps<CoverAttributes>> = ({ data }) => {
  const attributes: CoverAttributes = data.attributes

  const overlayColor = colorMapper(attributes.overlayColor, "unset")
  const contentPosition: CoverTextPosition =
    textPosition[attributes.contentPosition] === undefined
      ? { alignItems: "center", justifyContent: "center" }
      : textPosition[attributes.contentPosition]
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
        overlayColor={overlayColor}
        contentPosition={contentPosition}
      >
        <div
          className={css`
            width: auto;
          `}
        >
          <ContentRenderer data={data.innerBlocks}></ContentRenderer>
        </div>
      </LayoutContainer>
    </pre>
  )
}

export default CoverBlock
