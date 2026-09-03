"use client"

import { useTranslation } from "react-i18next"

import { Link } from "@/shared-module/components"

interface Props {
  courseInstanceId: string
}

const CompletionsExportButton: React.FC<React.PropsWithChildren<Props>> = ({
  courseInstanceId,
}) => {
  const { t } = useTranslation()
  return (
    <Link
      href={`/api/v0/main-frontend/course-instances/${courseInstanceId}/export-completions`}
      aria-label={t("link-export-completions")}
      download
      styledAsButton
      variant="secondary"
      size="medium"
    >
      {t("link-export-completions")}
    </Link>
  )
}

export default CompletionsExportButton
