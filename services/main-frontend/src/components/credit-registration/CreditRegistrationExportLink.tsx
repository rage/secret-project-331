"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { Link } from "@/shared-module/components"

interface Props {
  courseId: string
}

/** One element, not a Button inside an anchor: a download is a link wherever the keyboard is concerned. */
const CreditRegistrationExportLink: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()
  return (
    <Link
      href={`/api/v0/main-frontend/course-credit-registrations/courses/${courseId}/export`}
      styledAsButton
      variant="secondary"
      size="medium"
      download
    >
      {t("link-export-credit-registration-statuses")}
    </Link>
  )
}

export default CreditRegistrationExportLink
