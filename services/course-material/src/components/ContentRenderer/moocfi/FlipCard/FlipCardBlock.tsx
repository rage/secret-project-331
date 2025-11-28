import { css } from "@emotion/css"
import React, { useEffect, useRef, useState } from "react"
import { useButton, useFocusRing, useHover } from "react-aria"
import { useTranslation } from "react-i18next"

import ContentRenderer, { BlockRendererProps } from "../.."
import { ImageInteractivityContext } from "../../core/common/Image/ImageInteractivityContext"

import { Block } from "@/services/backend"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
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

  const cardRef = useRef<HTMLDivElement>(null)
  const frontContentRef = useRef<HTMLDivElement>(null)
  const backContentRef = useRef<HTMLDivElement>(null)

  const { hoverProps, isHovered } = useHover({})

  const buttonRef = useRef<HTMLButtonElement>(null)
  const { buttonProps, isPressed } = useButton(
    {
      onPress: () => setIsFlipped(!isFlipped),
      "aria-pressed": isFlipped,
    },
    buttonRef,
  )
  const { focusProps, isFocusVisible } = useFocusRing()

  useEffect(() => {
    if (isFlipped && backContentRef.current) {
      const firstFocusable = backContentRef.current.querySelector<HTMLElement>(
        'a, button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (firstFocusable) {
        firstFocusable.focus()
      }
    } else if (!isFlipped && frontContentRef.current) {
      const firstFocusable = frontContentRef.current.querySelector<HTMLElement>(
        'a, button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (firstFocusable) {
        firstFocusable.focus()
      }
    }
  }, [isFlipped])

  return (
    <div
      ref={cardRef}
      className={css`
        background-color: transparent;
        width: 100%;
        max-width: 100%;
        height: auto;
        min-height: 200px;
        perspective: 1000px;
        margin: 0 auto;

        ${respondToOrLarger.xxs} {
          max-width: ${size}px;
          height: ${size}px;
        }
      `}
      {...hoverProps}
    >
      {/* Disable all image interactivity (zoom and links) inside flip cards */}
      <ImageInteractivityContext.Provider value={{ disableInteractivity: true }}>
        <div
          className={css`
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
          `}
        >
          <div
            ref={frontContentRef}
            className={css`
              position: absolute;
              width: 100%;
              height: 100%;
              margin: 0px !important;
              padding: 0px !important;
              background-color: ${baseTheme.colors.gray[100]};
              border-radius: 10px;
              overflow: hidden;
              backface-visibility: hidden;

              ${!currentIsImage && `border: 3px solid ${baseTheme.colors.gray[300]};`}

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
            ref={backContentRef}
            className={css`
              position: absolute;
              width: 100%;
              height: 100%;
              margin: 0px !important;
              background-color: ${baseTheme.colors.gray[100]};
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
      <button
        ref={buttonRef}
        {...buttonProps}
        {...focusProps}
        className={css`
          display: block;
          margin: 1rem auto 0;
          padding: 0.5rem 1rem;
          border: 2px solid ${baseTheme.colors.gray[600]};
          border-radius: 8px;
          background-color: ${baseTheme.colors.clear[100]};
          color: ${baseTheme.colors.gray[700]};
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            background-color: ${baseTheme.colors.clear[200]};
            border-color: ${baseTheme.colors.gray[500]};
          }

          &:active {
            background-color: ${baseTheme.colors.gray[100]};
          }

          ${isFocusVisible
            ? `
            outline: 2px solid ${baseTheme.colors.blue[500]};
            outline-offset: 2px;
          `
            : ""}

          ${isPressed
            ? `
            transform: scale(0.98);
          `
            : ""}
        `}
      >
        {t("button-text-flip")}
      </button>
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
  return 400
}

export default withErrorBoundary(FlipCardBlock)
