import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer, { BlockRendererProps } from "../.."

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

  const [frontSideUp, setFrontSideUp] = useState(true)
  const currentIsImage = isBlockImage(frontSideUp ? frontCard : backCard)

  return (
    <div
      aria-label={t("flip-card")}
      className={css`
        display: flex;
        align-items: center;
        width: ${size}px;
        height: ${size}px;
        perspective: 1000px;
        color: #4c5868;

        :hover {
          cursor: pointer;
        }
        .parent div {
          border: 10px;
        }
      `}
      onClick={() => (frontSideUp ? setFrontSideUp(false) : setFrontSideUp(true))}
      onKeyDown={() => (frontSideUp ? setFrontSideUp(false) : setFrontSideUp(true))}
      role="presentation"
    >
      <div
        className={css`
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.8s;
          transform-style: preserve-3d;
          ${frontSideUp ? "transform: rotateY(180deg);" : "transform: rotateY(0);"}
          ${!currentIsImage && "border: 3px solid #bfbec6;"}
          border-radius: 10px;
        `}
      >
        <div
          className={css`
            transform: rotateY(180deg);
            -webkit-backface-visibility: hidden; /* Safari */
            backface-visibility: hidden;
            position: absolute;
            width: 100%;
            height: 100%;
            margin: 0px !important;
            padding: 0px !important;
            background-color: #f4f4f6;
            border-radius: 10px;
            overflow-x: auto;

            display: flex;
            flex-direction: column;
            justify-content: center;
          `}
        >
          <ContentRenderer
            data={[frontCard]}
            editing={false}
            selectedBlockId={null}
            setEdits={function (): void {}}
            isExam={false}
          />
        </div>
        <div
          className={css`
            -webkit-backface-visibility: hidden; /* Safari */
            backface-visibility: hidden;
            position: absolute;
            width: 100%;
            height: 100%;
            margin: 0px !important;
            background-color: #f4f4f6;
            border-radius: 10px;
            overflow-x: auto;

            display: flex;
            flex-direction: column;
            justify-content: center;
          `}
        >
          <ContentRenderer
            data={[backCard]}
            editing={false}
            selectedBlockId={null}
            setEdits={function (): void {}}
            isExam={false}
          />
        </div>
      </div>
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
