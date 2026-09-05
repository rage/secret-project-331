"use client"

import React from "react"
import { Trans, useTranslation } from "react-i18next"

import StudentNumberCard from "@/components/credit-registration/StudentNumberCard"
import { noteCss, sectionsCss } from "@/components/credit-registration/styles"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { profileStudiesRoute } from "@/shared-module/common/utils/routes"
import { Link } from "@/shared-module/components"

const StudentNumberSettingsPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("heading-student-number"), { order: 10 })
  const studiesLink = <Link href={profileStudiesRoute()} />

  return (
    <div className={sectionsCss}>
      <StudentNumberCard />
      <p className={noteCss}>
        <Trans
          t={t}
          i18nKey="settings-student-number-see-your-studies"
          components={{ studiesLink }}
        />
      </p>
    </div>
  )
}

export default StudentNumberSettingsPage
