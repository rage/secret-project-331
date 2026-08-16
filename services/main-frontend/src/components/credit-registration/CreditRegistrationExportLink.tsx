"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/shared-module/components"

interface Props {
  courseId: string
}

const CreditRegistrationExportLink: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()
  return (
    <a
      href={`/api/v0/main-frontend/course-credit-registrations/courses/${courseId}/export`}
      aria-label={t("link-export-credit-registrations")}
      download
    >
      <Button variant="secondary" size="medium" type="button">
        {t("link-export-credit-registrations")}
      </Button>
    </a>
  )
}

export default CreditRegistrationExportLink
