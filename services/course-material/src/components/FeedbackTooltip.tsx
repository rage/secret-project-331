import { css, cx } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { useFeedbackStore } from "../stores/materialFeedbackStore"

import SpeechBalloon from "@/shared-module/common/components/SpeechBalloon"
import { feedbackTooltipClass } from "@/shared-module/common/styles/constants"

const FeedbackTooltip: React.FC = () => {
  const { t } = useTranslation()
  const { selection, setCurrentlyOpenFeedbackDialog } = useFeedbackStore()

  if (!selection.position) {
    return null
  }

  const x = Math.max(
    0,
    Math.min(window.innerWidth - 150, window.scrollX + selection.position.x - 60),
  )
  const y = Math.max(window.screenY, window.scrollY + selection.position.y - 70)

  const handleClick = () => {
    // eslint-disable-next-line i18next/no-literal-string
    setCurrentlyOpenFeedbackDialog("select-type")
  }

  const balloonCss = css`
    position: absolute;
    top: ${y}px;
    left: ${x}px;
    z-index: 100;
  `

  return (
    <SpeechBalloon onClick={handleClick} className={cx(balloonCss, feedbackTooltipClass)}>
      {t("give-feedback")}
    </SpeechBalloon>
  )
}

export default FeedbackTooltip
