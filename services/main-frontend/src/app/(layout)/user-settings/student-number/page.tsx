"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import StudentNumberCard from "@/components/credit-registration/StudentNumberCard"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { profileCreditRegistrationRoute } from "@/shared-module/common/utils/routes"
import { Link } from "@/shared-module/components"

const pageCss = css`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  ${respondToOrLarger.md} {
    gap: 1.5rem;
  }
`

const pointerCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
  color: var(--color-gray-600);
  font-size: 0.9375rem;
`

const StudentNumberSettingsPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("heading-student-number"), { order: 10 })

  return (
    <div className={pageCss}>
      <StudentNumberCard />
      <div className={pointerCss}>
        <span>{t("your-credit-registrations-are-in-your-profile")}</span>
        <Link href={profileCreditRegistrationRoute()}>{t("profile-credit-registration-tab")}</Link>
      </div>
    </div>
  )
}

export default StudentNumberSettingsPage
