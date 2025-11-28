import { css } from "@emotion/css"
import { ReplayArrowLeftRight } from "@vectopus/atlas-icons-react"
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

  const frontButtonRef = useRef<HTMLButtonElement>(null)
  const { buttonProps: frontButtonProps, isPressed: isFrontPressed } = useButton(
    {
      onPress: () => setIsFlipped(!isFlipped),
      "aria-pressed": isFlipped,
    },
    frontButtonRef,
  )
  const { focusProps: frontFocusProps, isFocusVisible: isFrontFocusVisible } = useFocusRing()

  const backButtonRef = useRef<HTMLButtonElement>(null)
  const { buttonProps: backButtonProps, isPressed: isBackPressed } = useButton(
    {
      onPress: () => setIsFlipped(!isFlipped),
      "aria-pressed": isFlipped,
    },
    backButtonRef,
  )
  const { focusProps: backFocusProps, isFocusVisible: isBackFocusVisible } = useFocusRing()

  // Move focus to the button on the visible side when the card flips
  useEffect(() => {
    if (isFlipped) {
      // Card is flipped, focus the back button
      backButtonRef.current?.focus()
    } else {
      // Card is not flipped, focus the front button
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
            <ContentRenderer data={[frontCard]} isExam={false} />
            {!isFlipped ? (
              <button
                ref={frontButtonRef}
                {...frontButtonProps}
                {...frontFocusProps}
                className={css`
                  position: absolute;
                  bottom: 10px;
                  right: 10px;
                  z-index: 1;
                  backface-visibility: hidden;
                  border-radius: 10px;
                  width: 54px;
                  height: 42px;
                  background: ${baseTheme.colors.clear[100]};
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  color: ${baseTheme.colors.gray[700]};
                  border: 2px solid ${baseTheme.colors.gray[600]};
                  cursor: pointer;
                  padding: 0;
                  font-size: 9px;

                  &::after {
                    content: "";
                    position: absolute;
                    left: -1000px;
                    top: -1000px;
                    right: -10px;
                    bottom: -10px;
                    z-index: -1;
                  }

                  ${isFrontFocusVisible &&
                  `
                    outline: 2px solid ${baseTheme.colors.blue[500]};
                    outline-offset: 2px;
                    border-radius: 10px;
                  `}

                  ${isFrontPressed &&
                  `
                    transform: scale(0.98);
                  `}
                `}
                aria-label={t("button-text-flip-to-back")}
              >
                <div>{t("button-text-flip")}</div>
                <ReplayArrowLeftRight size={16} />
              </button>
            ) : (
              <div
                className={css`
                  position: absolute;
                  bottom: 10px;
                  right: 10px;
                  z-index: 1;
                  backface-visibility: hidden;
                  border-radius: 10px;
                  width: 54px;
                  height: 42px;
                  background: ${baseTheme.colors.clear[100]};
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  color: ${baseTheme.colors.gray[700]};
                  border: 2px solid ${baseTheme.colors.gray[600]};
                  pointer-events: none;
                  font-size: 9px;
                `}
              >
                <div>{t("button-text-flip")}</div>
                <ReplayArrowLeftRight size={16} />
              </div>
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
            <ContentRenderer data={[backCard]} isExam={false} />
            {isFlipped ? (
              <button
                ref={backButtonRef}
                {...backButtonProps}
                {...backFocusProps}
                className={css`
                  position: absolute;
                  bottom: 10px;
                  right: 10px;
                  z-index: 1;
                  backface-visibility: hidden;
                  border-radius: 10px;
                  width: 54px;
                  height: 42px;
                  background: ${baseTheme.colors.clear[100]};
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  color: ${baseTheme.colors.gray[700]};
                  border: 2px solid ${baseTheme.colors.gray[600]};
                  cursor: pointer;
                  padding: 0;
                  font-size: 9px;

                  &::after {
                    content: "";
                    position: absolute;
                    left: -1000px;
                    top: -1000px;
                    right: -10px;
                    bottom: -10px;
                    z-index: -1;
                  }

                  ${isBackFocusVisible &&
                  `
                    outline: 2px solid ${baseTheme.colors.blue[500]};
                    outline-offset: 2px;
                    border-radius: 10px;
                  `}

                  ${isBackPressed &&
                  `
                    transform: scale(0.98);
                  `}
                `}
                aria-label={t("button-text-flip-to-front")}
              >
                <div>{t("button-text-flip")}</div>
                <ReplayArrowLeftRight size={16} />
              </button>
            ) : (
              <div
                className={css`
                  position: absolute;
                  bottom: 10px;
                  right: 10px;
                  z-index: 1;
                  backface-visibility: hidden;
                  border-radius: 10px;
                  width: 54px;
                  height: 42px;
                  background: ${baseTheme.colors.clear[100]};
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  color: ${baseTheme.colors.gray[700]};
                  border: 2px solid ${baseTheme.colors.gray[600]};
                  pointer-events: none;
                  font-size: 9px;
                `}
              >
                <div>{t("button-text-flip")}</div>
                <ReplayArrowLeftRight size={16} />
              </div>
            )}
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
