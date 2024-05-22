import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { baseTheme } from "@/shared-module/common/styles"

interface CourseTestModeNotificationProps {
  isTestMode: boolean
}

const CourseTestModeNotification: React.FC<
  React.PropsWithChildren<CourseTestModeNotificationProps>
> = ({ isTestMode }) => {
  const { t } = useTranslation()
  if (!isTestMode) {
    return null
  }

  return (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          text-align: center;
          background: ${baseTheme.colors.red[600]};
          color: ${baseTheme.colors.clear[100]};
          padding: 2rem 0rem;
          font-size: ${baseTheme.fontSizes[3]}px;
        `}
      >
        {t("test-version-of-course-text")}
      </div>
    </BreakFromCentered>
  )
}

export default CourseTestModeNotification
