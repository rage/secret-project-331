"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import StudentNumberCard from "@/components/credit-registration/StudentNumberCard"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import ConsentsCard from "./ConsentsCard"
import RegistrationsCard from "./RegistrationsCard"

const pageCss = css`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`

const CreditRegistrationProfilePage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("profile-credit-registration-tab"), { order: 10 })

  return (
    <div className={pageCss}>
      {/* Each card owns its own query and error boundary: a failing consents list must not blank the
          student number the whole flow depends on. */}
      <StudentNumberCard />
      <ConsentsCard />
      <RegistrationsCard />
    </div>
  )
}

export default withErrorBoundary(CreditRegistrationProfilePage)
