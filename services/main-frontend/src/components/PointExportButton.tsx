import { useTranslation } from "react-i18next"

const PointExportButton: React.FC<{ courseInstanceId: string }> = ({ courseInstanceId }) => {
  const { t } = useTranslation()
  return (
    <a
      href={`/api/v0/main-frontend/course-instances/${courseInstanceId}/point_export`}
      download={`points-${courseInstanceId}.csv`}
    >
      {t("export-points-as-csv")}
    </a>
  )
}

export default PointExportButton
