import { css } from "@emotion/css"
import React, { useState } from "react"

import ContentRenderer, { BlockRendererProps } from "../.."

import { Block } from "@/services/backend"
import { NewProposedBlockEdit } from "@/shared-module/common/bindings"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface FlipCardAttributes {
  backgroundColor: string
  front: Block<unknown>
}

const FlipCardBlock: React.FC<React.PropsWithChildren<BlockRendererProps<FlipCardAttributes>>> = (
  props,
) => {
  const data = props
  console.log(data)
  const frontCard = props.data.innerBlocks[0]
  const backCard = props.data.innerBlocks[1]
  console.log(frontCard)

  const [x, setX] = useState(1)
  return (
    <div
      className={css`
        background-color: transparent;
        width: 300px;
        height: 200px;
        perspective: 1000px;
      `}
      onClick={() => (x === 0 ? setX(1) : setX(0))}
      onKeyDown={() => (x === 0 ? setX(1) : setX(0))}
      role="presentation"
    >
      <div
        className={css`
          position: relative;
          width: 100%;
          height: 100%;
          border: 1px solid black;
          transition: transform 0.8s;
          transform-style: preserve-3d;
          ${x ? "transform: rotateY(180deg);" : "transform: rotateY(0);"}
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
          `}
        >
          <ContentRenderer
            data={[frontCard]}
            editing={false}
            selectedBlockId={null}
            setEdits={function (
              _value: React.SetStateAction<Map<string, NewProposedBlockEdit>>,
            ): void {
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
          `}
        >
          <ContentRenderer
            data={[backCard]}
            editing={false}
            selectedBlockId={null}
            setEdits={function (
              _value: React.SetStateAction<Map<string, NewProposedBlockEdit>>,
            ): void {
              throw new Error("Function not implemented.")
            }}
            isExam={false}
          />{" "}
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(FlipCardBlock)
