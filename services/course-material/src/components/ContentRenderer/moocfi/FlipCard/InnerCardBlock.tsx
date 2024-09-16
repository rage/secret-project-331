import { css } from "@emotion/css"
import { ReplayArrowLeftRight } from "@vectopus/atlas-icons-react"
import React from "react"

import { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

import { Block } from "@/services/backend"
import Button from "@/shared-module/common/components/Button"
import { theme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface FlipCardAttributes {
  href: string
  alt: string
  height: string
  width: string
  backgroundColor: string
}

function isBlockImage(block: Block<unknown>): block is Block<FlipCardAttributes> {
  return block.name === "core/image"
}

const InnerCardBlock: React.FC<React.PropsWithChildren<BlockRendererProps<FlipCardAttributes>>> = (
  props,
) => {
  if (isBlockImage(props.data.innerBlocks[0]) && props.data.innerBlocks.length == 1) {
    const imageBlock = props.data.innerBlocks[0] as Block<FlipCardAttributes>
    const imageLink = imageBlock.attributes.href
    const altText = imageBlock.attributes.alt
    return (
      <div
        className={css`
          display: flex;
          flex-direction: column;
          margin: 0 !important;
        `}
      >
        <img
          src={imageLink}
          alt={altText}
          width={imageBlock.attributes.width}
          height={imageBlock.attributes.height}
        />
        <div
          className={css`
            position: fixed;
            bottom: 5px;
            right: 5px;
          `}
        >
          <Button variant={"icon"} size={"small"}>
            <ReplayArrowLeftRight
              size={28}
              className={css`
                color: white;
                border-radius: 5px;
                background-color: rgba(0, 0, 0, 0.5);
                padding: 4px;

                &:hover {
                  color: ${theme.primary.hoverBorder};
                }
              `}
            />
          </Button>
        </div>
      </div>
    )
  } else {
    return (
      <div
        className={css`
          display: flex;
          flex-direction: column;

          padding-left: 1rem;
          padding-right: 1rem;
          margin-top: 1rem !important;

          ul {
            padding-inline-start: 1rem !important;
          }
        `}
      >
        <InnerBlocks parentBlockProps={props} />
        <div
          className={css`
            position: fixed;
            bottom: 5px;
            right: 5px;
          `}
        >
          <Button variant={"icon"} size={"small"}>
            <ReplayArrowLeftRight
              size={28}
              className={css`
                color: white;
                border-radius: 5px;
                background-color: rgba(0, 0, 0, 0.5);
                padding: 4px;

                &:hover {
                  color: ${theme.primary.hoverBorder};
                }
              `}
            />
          </Button>
        </div>
      </div>
    )
  }
}

const exported = withErrorBoundary(InnerCardBlock)
// @ts-expect-error: Custom property
exported.dontUseDefaultBlockMargin = true

export default exported
