import { css } from "@emotion/css"

import SpeechBalloon from "../shared-module/components/SpeechBalloon"

interface FeedbackProps {
  selectionRect: DOMRect | null
  onClick: () => void
}

const FeedbackTooltip: React.FC<FeedbackProps> = ({ onClick, selectionRect }) => {
  if (selectionRect === null) {
    // hidden while there's no selection
    return <></>
  }

  const x = window.scrollX + selectionRect.x - 60
  const y = Math.max(window.scrollY, window.scrollY + selectionRect.y - 70)
  return (
    <SpeechBalloon
      id={"feedback-tooltip"}
      onClick={onClick}
      className={css`
        position: absolute;
        top: ${y}px;
        left: ${x}px;
        z-index: 100;
      `}
    >
      Give feedback
    </SpeechBalloon>
  )
}

export default FeedbackTooltip
