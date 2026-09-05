"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import StudentNumberCard from "@/components/credit-registration/StudentNumberCard"
import { headingCss, sectionsCss } from "@/components/credit-registration/styles"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import RegistrationsNeedingAttention from "./RegistrationsNeedingAttention"

const CreditRegistrationProfilePage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("profile-credit-registration-tab"), { order: 10 })

  return (
    <div className={sectionsCss}>
      <h2 className={headingCss}>{t("profile-credit-registration-tab")}</h2>
      <StudentNumberCard />
      <RegistrationsNeedingAttention />
    </div>
  )
}

export default withErrorBoundary(CreditRegistrationProfilePage)
