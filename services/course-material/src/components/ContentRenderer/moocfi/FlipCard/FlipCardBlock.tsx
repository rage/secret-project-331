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

  const [open, setOpen] = useState(1)
  return (
    <div
      aria-label={t("flip-card")}
      className={css`
        display: flex;
        flex-direction: column;
        background-color: transparent;
        width: ${size}px;
        height: ${size}px;
        perspective: 1000px;
        :hover {
          cursor: pointer;
        }
      `}
      onClick={() => (open === 0 ? setOpen(1) : setOpen(0))}
      onKeyDown={() => (open === 0 ? setOpen(1) : setOpen(0))}
      role="presentation"
    >
      <div
        className={css`
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.8s;
          transform-style: preserve-3d;
          ${open ? "transform: rotateY(180deg);" : "transform: rotateY(0);"}

          box-shadow:
          0 2px 6px 0 rgba(0, 0, 0, 0.2),
          0 3px 10px 0 rgba(0, 0, 0, 0.19);
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
            margin: 0 !important;
            background-color: ${frontCard.attributes.backgroundColor};

            overflow-x: auto;
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
            margin: 0 !important;
            background-color: ${backCard.attributes.backgroundColor};

            overflow-x: auto;
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
