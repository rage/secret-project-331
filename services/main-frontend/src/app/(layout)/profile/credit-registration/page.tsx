"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import StudentNumberCard from "@/components/credit-registration/StudentNumberCard"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import RegistrationsCard from "./RegistrationsCard"

const pageCss = css`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`

const headingCss = css`
  font-size: 1.125rem;
  font-weight: ${fontWeights.semibold};
  color: ${baseTheme.colors.gray[700]};
  margin: 0;
`

const CreditRegistrationProfilePage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("profile-credit-registration-tab"), { order: 10 })

  return (
    <div className={pageCss}>
      {/* The cards below each render their own h3; without this h2 the layout's h1 skips straight to h3. */}
      <h2 className={headingCss}>{t("heading-credit-registration")}</h2>
      <StudentNumberCard />
      <RegistrationsCard />
    </div>
  )
}

export default withErrorBoundary(CreditRegistrationProfilePage)
