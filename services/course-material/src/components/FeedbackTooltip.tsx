import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { SelectionPosition } from "./FeedbackHandler"

import SpeechBalloon from "@/shared-module/common/components/SpeechBalloon"
import { feedbackTooltipClass } from "@/shared-module/common/styles/constants"

interface FeedbackProps {
  selectionRect: SelectionPosition
  onClick: () => void
}

const FeedbackTooltip: React.FC<React.PropsWithChildren<FeedbackProps>> = ({
  onClick,
  selectionRect,
}) => {
  const { t } = useTranslation()
  const x = Math.max(0, Math.min(window.innerWidth - 150, window.scrollX + selectionRect.x - 60))
  const y = Math.max(window.screenY, window.scrollY + selectionRect.y - 70)
  // eslint-disable-next-line i18next/no-literal-string
  const balloonCss = css`
    position: absolute;
    top: ${y}px;
    left: ${x}px;
    z-index: 100;
  `
  return (
    <>
      <SpeechBalloon onClick={onClick} className={`${balloonCss} ${feedbackTooltipClass}`}>
        {t("give-feedback")}
      </SpeechBalloon>
    </>
  )
}

export default FeedbackTooltip
