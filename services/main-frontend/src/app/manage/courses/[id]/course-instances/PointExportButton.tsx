"use client"

import { useTranslation } from "react-i18next"

import { downloadCourseInstancePointsCsv } from "@/services/backend/course-instances"
import Button from "@/shared-module/common/components/Button"

const PointExportButton: React.FC<
  React.PropsWithChildren<{ courseInstanceId: string; courseInstanceName: string }>
> = ({ courseInstanceId, courseInstanceName }) => {
  const { t } = useTranslation()
  return (
    <Button
      variant="secondary"
      size="medium"
      onClick={() => void downloadCourseInstancePointsCsv(courseInstanceId, courseInstanceName)}
      aria-label={`${t("link-export-points")} (${courseInstanceName})`}
    >
      {t("link-export-points")}
    </Button>
  )
}

export default PointExportButton
