"use client"

import { useTranslation } from "react-i18next"

import { Link } from "@/shared-module/components"

const PointExportButton: React.FC<
  React.PropsWithChildren<{ courseInstanceId: string; courseInstanceName: string }>
> = ({ courseInstanceId, courseInstanceName }) => {
  const { t } = useTranslation()
  return (
    <Link
      href={`/api/v0/main-frontend/course-instances/${courseInstanceId}/export-points`}
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
