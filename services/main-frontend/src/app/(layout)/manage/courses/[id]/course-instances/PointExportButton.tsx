"use client"

import { useTranslation } from "react-i18next"

import { Link } from "@/shared-module/components"
import { courseInstancePointsCsvHref } from "@/utils/exportDownloadUrls"

const PointExportButton: React.FC<
  React.PropsWithChildren<{ courseInstanceId: string; courseInstanceName: string }>
> = ({ courseInstanceId, courseInstanceName }) => {
  const { t } = useTranslation()
  return (
    <Link
      href={courseInstancePointsCsvHref(courseInstanceId)}
      aria-label={`${t("link-export-points")} (${courseInstanceName})`}
      download
      styledAsButton
      variant="secondary"
      size="medium"
    >
      {t("link-export-points")}
    </Link>
  )
}

export default PointExportButton
