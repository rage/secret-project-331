import { css } from "@emotion/css"
import { ReplayArrowLeftRight } from "@vectopus/atlas-icons-react"
import { t } from "i18next"
import React from "react"

import { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

import { Block } from "@/services/backend"
import Button from "@/shared-module/common/components/Button"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface FlipCardAttributes {
  href: string
  alt: string
  height: string
  width: string
  backgroundColor: string
}

function isBlockImage(block: Block<unknown>): block is Block<FlipCardAttributes> {
  if (block.innerBlocks.length > 0) {
    return block.innerBlocks[0].name === "core/image"
  }
  return false
}

const InnerCardBlock: React.FC<React.PropsWithChildren<BlockRendererProps<FlipCardAttributes>>> = (
  props,
) => {
  // Checks if the inner card block is an image to render it correctly
  if (isBlockImage(props.data) && props.data.innerBlocks.length == 1) {
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
            <div
              className={css`
                position: fixed;
                bottom: 10px;
                right: 10px;
                border-radius: 10px;
                width: 54px;
                height: 42px;
                background: #f9f9f9;
                box-shadow: 0 4px 0px 0px #c4c4c4;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #57606fcc;
                :hover {
                  color: green;
                }
              `}
            >
              <div
                className={css`
                  font-size: 9px;
                `}
              >
                {t("button-text-flip")}
              </div>
              <ReplayArrowLeftRight size={16} />
            </div>
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
          justify-content: center;
          align-items: center;
          ul {
            padding-inline-start: 1rem !important;
          }
          h1,
          h2,
          h3,
          h4,
          h5 {
            margin-top: 0px;
          }
        `}
      >
        <InnerBlocks parentBlockProps={props} />
        <Button variant={"icon"} size={"small"}>
          <div
            className={css`
              position: fixed;
              bottom: 10px;
              right: 10px;
              border-radius: 10px;
              width: 54px;
              height: 42px;
              background: #f9f9f9;
              box-shadow: 0 4px 0px 0px #c4c4c4;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              color: #57606fcc;
              :hover {
                color: green;
              }
            `}
          >
            <div
              className={css`
                font-size: 9px;
              `}
            >
              {t("button-text-flip")}
            </div>
            <ReplayArrowLeftRight size={16} />
          </div>
        </Button>
      </div>
    )
  }
}

const exported = withErrorBoundary(InnerCardBlock)
// @ts-expect-error: Custom property
exported.dontUseDefaultBlockMargin = true

export default exported
