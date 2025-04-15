import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer, { BlockRendererProps } from "../.."
import { ImageInteractivityContext } from "../../core/common/Image/ImageInteractivityContext"

import { Block } from "@/services/backend"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface FlipCardAttributes {
  backgroundColor: string
  size: string
}

function isBlockImage(block: Block<unknown>): block is Block<FlipCardAttributes> {
  if (block.innerBlocks.length > 0) {
    return block.innerBlocks[0].name === "core/image"
  }
  return false
}

const FlipCardBlock: React.FC<React.PropsWithChildren<BlockRendererProps<FlipCardAttributes>>> = (
  props,
) => {
  const { t } = useTranslation()
  const frontCard = props.data.innerBlocks[0] as Block<FlipCardAttributes>
  const backCard = props.data.innerBlocks[1] as Block<FlipCardAttributes>
  const size = sizeStringToSizepx(props.data)
  const currentIsImage = isBlockImage(frontCard)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      aria-label={t("flip-card")}
      className={css`
        background-color: transparent;
        width: ${size}px;
        height: ${size}px;
        perspective: 1000px;
        margin: 0 auto;
        cursor: pointer;
      `}
      onClick={() => setIsFlipped(!isFlipped)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setIsFlipped(!isFlipped)
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Disable all image interactivity (zoom and links) inside flip cards */}
      <ImageInteractivityContext.Provider value={{ disableInteractivity: true }}>
        <div
          className={`inner ${css`
            position: relative;
            width: 100%;
            height: 100%;
            text-align: center;
            transition: transform 0.4s ease-out;
            transform-style: preserve-3d;
            transform: ${isFlipped
              ? isHovered
                ? "rotateY(180deg)"
                : "rotateY(180deg)"
              : isHovered
                ? "rotateY(10deg)"
                : "rotateY(0)"};
          `}`}
        >
          <div
            className={css`
              position: absolute;
              width: 100%;
              height: 100%;
              margin: 0px !important;
              padding: 0px !important;
              background-color: #f4f4f6;
              border-radius: 10px;
              overflow: hidden;
              backface-visibility: hidden;

              ${!currentIsImage && "border: 3px solid #bfbec6;"}

              display: flex;
              flex-direction: column;
              justify-content: center;

              /** https://bugzilla.mozilla.org/show_bug.cgi?id=1201471 */
              transform: rotateX(0deg);
            `}
          >
            <ContentRenderer data={[frontCard]} isExam={false} />
          </div>
          <div
            className={css`
              position: absolute;
              width: 100%;
              height: 100%;
              margin: 0px !important;
              background-color: #f4f4f6;
              border-radius: 10px;
              overflow: hidden;
              backface-visibility: hidden;

              transform: rotateY(180deg);

              display: flex;
              flex-direction: column;
              justify-content: center;
            `}
          >
            <ContentRenderer data={[backCard]} isExam={false} />
          </div>
        </div>
      </ImageInteractivityContext.Provider>
    </div>
  )
}

function sizeStringToSizepx(block: Block<FlipCardAttributes>) {
  if (block.attributes.size == "xl") {
    return 500
  } else if (block.attributes.size == "m") {
    return 400
  } else if (block.attributes.size == "s") {
    return 300
  }
}

export default withErrorBoundary(FlipCardBlock)
