"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import StudentNumberCard from "@/components/credit-registration/StudentNumberCard"
import { sectionsCss } from "@/components/credit-registration/styles"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"

const StudentNumberSettingsPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("heading-student-number"), { order: 10 })

  return (
    <div className={sectionsCss}>
      <StudentNumberCard />
    </div>
  )
}

export default StudentNumberSettingsPage
