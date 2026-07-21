"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import YellowBox from "@/components/course-material/YellowBox"

export interface OutOfTriesNotificationProps {
  ranOutOfTries: boolean
}

// Wrapper stays mounted with role="status" so screen readers announce the message when it appears.
const OutOfTriesNotification: React.FC<OutOfTriesNotificationProps> = ({ ranOutOfTries }) => {
  const { t } = useTranslation()

  return (
    <div role="status">
      {ranOutOfTries && <YellowBox>{t("out-of-tries-description")}</YellowBox>}
    </div>
  )
}

export default OutOfTriesNotification
