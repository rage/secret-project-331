"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { Link } from "@/shared-module/components"

interface Props {
  courseId: string
}

const CreditRegistrationExportLink: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()
  return (
    <Link
      href={`/api/v0/main-frontend/course-credit-registrations/courses/${courseId}/export`}
      aria-label={t("link-export-credit-registrations")}
      download
      styledAsButton
      variant="secondary"
      size="medium"
    >
      {t("link-export-credit-registrations")}
    </Link>
  )
}

export default CreditRegistrationExportLink
