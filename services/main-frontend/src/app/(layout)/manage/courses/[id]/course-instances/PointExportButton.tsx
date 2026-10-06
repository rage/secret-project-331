"use client"

import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import { courseInstancePointsCsvHref } from "@/utils/exportDownloadUrls"

const PointExportButton: React.FC<
  React.PropsWithChildren<{ courseInstanceId: string; courseInstanceName: string }>
> = ({ courseInstanceId, courseInstanceName }) => {
  const { t } = useTranslation()
  return (
    <a
      href={courseInstancePointsCsvHref(courseInstanceId)}
      aria-label={`${t("link-export-points")} (${courseInstanceName})`}
      download
    >
      <Button variant="secondary" size="medium" type="button">
        {t("link-export-points")}
      </Button>
    </a>
  )
}

export default PointExportButton
