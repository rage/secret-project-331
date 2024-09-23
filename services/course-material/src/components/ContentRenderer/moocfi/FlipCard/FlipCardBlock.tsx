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
  return block.name === "core/image"
}

const FlipCardBlock: React.FC<React.PropsWithChildren<BlockRendererProps<FlipCardAttributes>>> = (
  props,
) => {
  const { t } = useTranslation()
  const frontCard = props.data.innerBlocks[0] as Block<FlipCardAttributes>
  const backCard = props.data.innerBlocks[1] as Block<FlipCardAttributes>

  let size = 0
  if (props.data.attributes.size == "xl") {
    size = 500
  } else if (props.data.attributes.size == "m") {
    size = 400
  } else if (props.data.attributes.size == "s") {
    size = 300
  }

  const [frontSideUp, setFrontSideUp] = useState(true)
  const currentIsImage = isBlockImage(
    frontSideUp ? frontCard.innerBlocks[0] : backCard.innerBlocks[0],
  )

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
          ${currentIsImage ? "" : "border: 3px solid #bfbec6"};
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
            setEdits={function (): void {
              throw new Error("Function not implemented.")
            }}
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
            setEdits={function (): void {
              throw new Error("Function not implemented.")
            }}
            isExam={false}
          />
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(FlipCardBlock)
