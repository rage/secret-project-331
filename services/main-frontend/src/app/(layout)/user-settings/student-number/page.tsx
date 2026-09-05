"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import StudentNumberCard from "@/components/credit-registration/StudentNumberCard"
import { noteCss, rowCss, sectionsCss } from "@/components/credit-registration/styles"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { profileCreditRegistrationRoute } from "@/shared-module/common/utils/routes"
import { Link } from "@/shared-module/components"

const StudentNumberSettingsPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("heading-student-number"), { order: 10 })

  return (
    <div className={sectionsCss}>
      <StudentNumberCard />
      <div className={cx(rowCss, noteCss)}>
        <span>{t("your-credit-registrations-are-in-your-profile")}</span>
        <Link href={profileCreditRegistrationRoute()}>{t("profile-credit-registration-tab")}</Link>
      </div>
    </div>
  )
}

export default StudentNumberSettingsPage
