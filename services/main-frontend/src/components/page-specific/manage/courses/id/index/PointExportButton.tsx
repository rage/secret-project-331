import { useTranslation } from "react-i18next"

const PointExportButton: React.FC<{ courseInstanceId: string; courseInstanceName: string }> = ({
  courseInstanceId,
  courseInstanceName,
}) => {
  const { t } = useTranslation()
  return (
    <a
      href={`/api/v0/main-frontend/course-instances/${courseInstanceId}/points/export`}
      download={`points-${courseInstanceId}.csv`}
      aria-label={`${t("link-export-points")} (${courseInstanceName})`}
    >
      {t("link-export-points")}
    </a>
  )
}

export default PointExportButton
