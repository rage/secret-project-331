"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import YellowBox from "@/components/course-material/YellowBox"
import type { ReviewingStage } from "@/generated/course-material-api/types.generated"

export interface OutOfTriesNotificationProps {
  ranOutOfTries: boolean
  /** Undefined for exams, which have no reviewing stage. */
  reviewingStage: ReviewingStage | undefined
}

// Wrapper stays mounted with role="status" so screen readers announce the message when it appears.
const OutOfTriesNotification: React.FC<OutOfTriesNotificationProps> = ({
  ranOutOfTries,
  reviewingStage,
}) => {
  const { t } = useTranslation()

  // The try limit only ever stops a new answer, but the message reads as a blanket ban: next to
  // the peer review form it looks like peer reviewing is out of tries too.
  const show = ranOutOfTries && (reviewingStage === undefined || reviewingStage === "NotStarted")

  return <div role="status">{show && <YellowBox>{t("out-of-tries-description")}</YellowBox>}</div>
}

export default OutOfTriesNotification
