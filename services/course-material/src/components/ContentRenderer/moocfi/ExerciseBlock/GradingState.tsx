import React from "react"
import { useTranslation } from "react-i18next"

import { GradingProgress } from "../../../../shared-module/bindings"

interface GradingStateProps {
  gradingState: GradingProgress
}
const GradingState: React.FC<React.PropsWithChildren<GradingStateProps>> = ({ gradingState }) => {
  const { t } = useTranslation()
  return (
    <div>
      {gradingState === "Pending" && <p>{t("grading-pending")}</p>}
      {gradingState === "PendingManual" && <p>{t("grading-pending-manual")}</p>}
      {gradingState === "Failed" && <p>{t("grading-failed")}</p>}
      {gradingState === "FullyGraded" && <p>{t("grading-fully-graded")}</p>}
      {gradingState === "NotReady" && <p>{t("grading-pending")}</p>}
    </div>
  )
}

export default GradingState
