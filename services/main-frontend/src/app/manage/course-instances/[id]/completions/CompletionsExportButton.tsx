"use client"

import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"

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
      aria-label={t("link-export-completions")}
      download
    >
      <Button variant="secondary" size="medium" type="button">
        {t("link-export-completions")}
      </Button>
    </a>
  )
}

export default CompletionsExportButton
