"use client"

import { useTranslation } from "react-i18next"

import { Link } from "@/shared-module/components"

interface Props {
  courseInstanceId: string
}

/** One element, not a Button inside an anchor: a download is a link wherever the keyboard is concerned. */
const CompletionsExportButton: React.FC<React.PropsWithChildren<Props>> = ({
  courseInstanceId,
}) => {
  const { t } = useTranslation()
  return (
    <Link
      href={`/api/v0/main-frontend/course-instances/${courseInstanceId}/export-completions`}
      styledAsButton
      variant="secondary"
      size="medium"
      download
    >
      {t("link-export-grades")}
    </Link>
  )
}

export default CompletionsExportButton
