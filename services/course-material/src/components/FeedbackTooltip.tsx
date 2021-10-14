import { css } from "@emotion/css"

import SpeechBalloon from "../shared-module/components/SpeechBalloon"
import { feedbackTooltipClass } from "../shared-module/styles/constants"

import { SelectionPosition } from "./FeedbackHandler"

interface FeedbackProps {
  selectionRect: SelectionPosition
  onClick: () => void
}

const FeedbackTooltip: React.FC<FeedbackProps> = ({ onClick, selectionRect }) => {
  const x = window.scrollX + selectionRect.x - 60
  const y = Math.max(window.screenY, window.scrollY + selectionRect.y - 70)
  const balloonCss = css`
    position: absolute;
    top: ${y}px;
    left: ${x}px;
    z-index: 100;
  `
  return (
    <>
      <SpeechBalloon onClick={onClick} className={`${balloonCss} ${feedbackTooltipClass}`}>
        Give feedback
      </SpeechBalloon>
    </>
  )
}

export default FeedbackTooltip
