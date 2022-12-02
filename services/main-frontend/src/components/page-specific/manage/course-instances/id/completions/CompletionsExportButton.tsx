import { useTranslation } from "react-i18next"

interface Props {
  courseInstanceId: string
}

const CompletionsExportButton: React.FC<React.PropsWithChildren<Props>> = ({
  courseInstanceId,
}) => {
  const { t } = useTranslation()
  return (
    <a
      href={`/api/v0/main-frontend/course-instances/${courseInstanceId}/export-completions`}
      download={`completions-${courseInstanceId}.csv`}
      aria-label={`${t("link-export-completions")})`}
    >
      {t("link-export-completions")}
    </a>
  )
}

export default CompletionsExportButton
