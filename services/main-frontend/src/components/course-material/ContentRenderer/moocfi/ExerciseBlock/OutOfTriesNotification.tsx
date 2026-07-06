"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import YellowBox from "@/components/course-material/YellowBox"

export interface OutOfTriesNotificationProps {
  ranOutOfTries: boolean
}

/**
 * Visible notification shown when the user has used all their tries for an exercise.
 *
 * The wrapping element is a persistent `role="status"` live region so that screen
 * readers announce the message when it appears after the last submission.
 */
const OutOfTriesNotification: React.FC<OutOfTriesNotificationProps> = ({ ranOutOfTries }) => {
  const { t } = useTranslation()

  return (
    <div role="status">
      {ranOutOfTries && <YellowBox>{t("out-of-tries-description")}</YellowBox>}
    </div>
  )
}

export default OutOfTriesNotification
