import { css } from "@emotion/css"
import type { VirtualElement } from "@popperjs/core"
import { useAtom } from "jotai"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

import { currentlyOpenFeedbackDialogAtom, selectionAtom } from "../stores/materialFeedbackStore"

import SpeechBalloon from "@/shared-module/common/components/SpeechBalloon"
import { feedbackTooltipTestId } from "@/shared-module/common/styles/constants"

const FeedbackTooltip: React.FC = () => {
  const { t } = useTranslation()
  const [selection] = useAtom(selectionAtom)
  const [, setCurrentlyOpenFeedbackDialog] = useAtom(currentlyOpenFeedbackDialogAtom)
  const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

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

    const rect = {
      width: 0,
      height: 0,
      top: y,
      right: x,
      bottom: y,
      left: x,
      x: x,
      y: y,
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

  const { styles, attributes, update } = usePopper(virtualReference, referenceElement, {
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
          // Use direct positioning instead of transforms
          gpuAcceleration: false,
        },
      },
    ],
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

  const handleClick = () => {
    // eslint-disable-next-line i18next/no-literal-string
    setCurrentlyOpenFeedbackDialog("select-type")
  }

  // Position the tooltip absolutely using the selection coordinates
  const tooltipClass = css`
    z-index: 100;
    position: absolute;
    animation: fadeIn 0.2s ease-in-out;

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
      ref={setReferenceElement}
      className={tooltipClass}
      // eslint-disable-next-line react/forbid-dom-props
      style={styles.popper}
      {...attributes.popper}
    >
      <SpeechBalloon
        ref={setReferenceElement}
        onClick={handleClick}
        data-testid={feedbackTooltipTestId}
      >
        {t("give-feedback")}
      </SpeechBalloon>
    </div>
  )
}

export default FeedbackTooltip
