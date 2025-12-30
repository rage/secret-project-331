"use client"
import { css } from "@emotion/css"
import React, { useEffect, useRef, useState } from "react"
import { useHover, VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import ContentRenderer, { BlockRendererProps } from "../.."
import { ImageInteractivityContext } from "../../core/common/Image/ImageInteractivityContext"

import FlipButton from "./FlipButton"

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

  const frontButtonRef = useRef<HTMLButtonElement>(null)
  const backButtonRef = useRef<HTMLButtonElement>(null)

  // Move focus to the button on the visible side when the card flips
  useEffect(() => {
    if (isFlipped) {
      backButtonRef.current?.focus()
    } else {
      frontButtonRef.current?.focus()
    }
  }, [isFlipped])

  return (
    <div
      ref={cardRef}
      role="group"
      aria-roledescription={t("flip-card-roledescription")}
      className={css`
        position: relative;
        background-color: transparent;
        width: 100%;
        max-width: 100%;
        aspect-ratio: 1;
        min-height: 200px;
        perspective: 1000px;
        margin: 0 auto;

        ${respondToOrLarger.xxxs} {
          min-height: 250px;
        }

        ${respondToOrLarger.xxs} {
          max-width: ${size}px;
          aspect-ratio: unset;
          height: ${size}px;
          min-height: unset;
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
            data-testid="flip-card-front"
            aria-hidden={isFlipped}
            {...(isFlipped && { inert: true })}
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
            <VisuallyHidden>
              {t("flip-card-roledescription")}. {t("flip-card-front-side")}.
            </VisuallyHidden>
            <ContentRenderer data={[frontCard]} isExam={false} />
            {!isFlipped && (
              <FlipButton
                ref={frontButtonRef}
                onPress={() => setIsFlipped(!isFlipped)}
                ariaLabel={t("button-text-flip-to-back")}
              />
            )}
          </div>
          <div
            ref={backContentRef}
            data-testid="flip-card-back"
            aria-hidden={!isFlipped}
            {...(!isFlipped && { inert: true })}
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

              transform: rotateY(180deg);

              ${!currentIsImage && `border: 3px solid ${baseTheme.colors.gray[300]};`}

              display: flex;
              flex-direction: column;
              justify-content: center;
            `}
          >
            {isFlipped && (
              <FlipButton
                ref={backButtonRef}
                onPress={() => setIsFlipped(!isFlipped)}
                ariaLabel={t("button-text-flip-to-front")}
              />
            )}
            <VisuallyHidden>
              {t("flip-card-roledescription")}. {t("flip-card-back-side")}.
            </VisuallyHidden>
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
  return 400
}

export default withErrorBoundary(FlipCardBlock)
