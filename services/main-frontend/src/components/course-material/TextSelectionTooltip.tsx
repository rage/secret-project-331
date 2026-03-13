"use client"

import { css } from "@emotion/css"
import type { VirtualElement } from "@popperjs/core"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "react-aria-components"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

import AIChat from "@/img/course-material/ai-chat.svg"
import SpeechBalloon from "@/shared-module/common/components/SpeechBalloon"
import { baseTheme } from "@/shared-module/common/styles"
import { feedbackTooltipTestId } from "@/shared-module/common/styles/constants"
import { defaultChatbotCommunicationChannel } from "@/stores/course-material/chatbotDialogStore"
import {
  currentlyOpenFeedbackDialogAtom,
  selectionAtom,
} from "@/stores/course-material/materialFeedbackStore"

export const FEEDBACK_TOOLTIP_ID = "feedback-tooltip"

const svgCss = css`
  color: #111827;
  height: 1.25rem;
  position: relative;
  top: 4px;
  left: 5px;
`

interface Props {
  courseName: string
  pageTitle: string
}

const TextSelectionTooltip: React.FC<React.PropsWithChildren<Props>> = ({
  courseName,
  pageTitle,
}) => {
  // todo rename all feedback tooltip stuff?
  const { t } = useTranslation()
  const [selection] = useAtom(selectionAtom)
  const setCurrentlyOpenFeedbackDialog = useSetAtom(currentlyOpenFeedbackDialogAtom)

  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  const chatbotCommunicationChannel = useAtomValue(defaultChatbotCommunicationChannel)

  // Show tooltip after a delay so that it's less annoying
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    if (selection.text) {
      timeoutId = setTimeout(() => {
        setShowTooltip(true)
      }, 200)
    } else {
      setShowTooltip(false)
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [selection.text])

  // Simple getBoundingClientRect that directly uses the coordinates
  const getBoundingClientRect = useCallback((): DOMRect => {
    const x = selection.position?.x ?? 0
    const y = selection.position?.y ?? 0

    // Subtract scroll position to get viewport-relative coordinates
    const viewportX = x - window.scrollX
    const viewportY = y - window.scrollY

    const rect = {
      width: 0,
      height: 0,
      top: viewportY,
      right: viewportX,
      bottom: viewportY,
      left: viewportX,
      x: viewportX,
      y: viewportY,
    }
    return {
      ...rect,
      toJSON: () => rect,
    } as DOMRect
  }, [selection.position?.x, selection.position?.y])

  const virtualReference = useRef<VirtualElement>({
    getBoundingClientRect,
    contextElement: document.body,
  }).current

  // Update the reference function when selection changes
  useEffect(() => {
    virtualReference.getBoundingClientRect = getBoundingClientRect
  }, [getBoundingClientRect, virtualReference])

  const { styles, attributes, update } = usePopper(virtualReference, popperElement, {
    placement: "top",
    modifiers: [
      {
        name: "offset",
        options: {
          offset: [0, 8],
        },
      },
      {
        name: "preventOverflow",
        options: {
          padding: 8,
        },
      },
      {
        name: "computeStyles",
        options: {
          gpuAcceleration: false,
        },
      },
      {
        name: "eventListeners",
        options: {
          scroll: true,
          resize: true,
        },
      },
      { name: "flip", options: { fallbackPlacements: ["bottom"] } },
    ],
    strategy: "absolute",
  })

  // Force update when selection changes
  useEffect(() => {
    if (update) {
      update()
    }
  }, [selection.position, update])

  if (!selection.text || !showTooltip) {
    return null
  }

  const giveFeedbackHandleClick = () => {
    // eslint-disable-next-line i18next/no-literal-string
    setCurrentlyOpenFeedbackDialog("select-type" as const)
  }

  // Position the tooltip absolutely using the selection coordinates
  const tooltipClass = css`
    z-index: 100;
    position: absolute;
    animation: fadeIn 0.2s ease-in-out;
    pointer-events: auto;
    user-select: none;

    button {
      color: #111827;
      border: none;
      border-radius: 5px;
      background-color: transparent;
      cursor: pointer;
      padding: 0.66rem 1.2rem;

      text-align: left;

      &:hover {
        filter: brightness(0.925);
        background: ${baseTheme.colors.gray[25]};
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(5px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `

  return (
    <div
      ref={setPopperElement}
      className={tooltipClass}
      // eslint-disable-next-line react/forbid-dom-props
      style={styles.popper}
      {...attributes.popper}
      id={FEEDBACK_TOOLTIP_ID}
      data-testid={feedbackTooltipTestId}
    >
      <SpeechBalloon
        placement={attributes.popper?.["data-popper-placement"]}
        // eslint-disable-next-line i18next/no-literal-string
        paddingValue="0.2rem"
      >
        <div
          className={css`
            display: flex;
            flex-flow: column nowrap;
          `}
        >
          <Button
            onClick={() => {
              chatbotCommunicationChannel?.newMessageMutation.mutate(
                t("text-selection-summarize-with-ai", {
                  pageTitle,
                  courseName,
                  selection: selection.text,
                }),
              )
            }}
          >
            {t("summarize")}
            <AIChat className={svgCss} />
          </Button>
          <Button
            onClick={() => {
              chatbotCommunicationChannel?.newMessageMutation.mutate(
                t("text-selection-explain-with-ai", {
                  pageTitle,
                  courseName,
                  selection: selection.text,
                }),
              )
            }}
          >
            {t("explain-this")}
            <AIChat className={svgCss} />
          </Button>
          <Button onClick={giveFeedbackHandleClick}>{t("give-feedback")}</Button>
        </div>
      </SpeechBalloon>
    </div>
  )
}

export default TextSelectionTooltip
