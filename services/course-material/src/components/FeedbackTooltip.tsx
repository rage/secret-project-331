import { css } from "@emotion/css"
import type { VirtualElement } from "@popperjs/core"
import { useAtom } from "jotai"
import { useRef, useState } from "react"
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

  const getBoundingClientRect = (): DOMRect => {
    const rect = {
      width: 0,
      height: 0,
      top: selection.position?.y ?? 0,
      right: selection.position?.x ?? 0,
      bottom: selection.position?.y ?? 0,
      left: selection.position?.x ?? 0,
      x: selection.position?.x ?? 0,
      y: selection.position?.y ?? 0,
    }
    return {
      ...rect,
      toJSON: () => rect,
    } as DOMRect
  }

  const virtualReference = useRef<VirtualElement>({
    getBoundingClientRect,
    contextElement: document.body,
  }).current

  const { styles, attributes } = usePopper(virtualReference, referenceElement, {
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
    ],
  })

  if (!selection) {
    return null
  }

  const handleClick = () => {
    // eslint-disable-next-line i18next/no-literal-string
    setCurrentlyOpenFeedbackDialog("select-type")
  }

  return (
    <SpeechBalloon
      ref={setReferenceElement}
      onClick={handleClick}
      data-testid={feedbackTooltipTestId}
      className={css`
        z-index: 100;
        position: ${styles.popper.position};
        top: ${styles.popper.top};
        left: ${styles.popper.left};
        transform: ${styles.popper.transform};
      `}
      {...attributes.popper}
    >
      {t("give-feedback")}
    </SpeechBalloon>
  )
}

export default FeedbackTooltip
