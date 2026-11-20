"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import DecisionsSection from "@/components/account-forms/DecisionsSection"
import RuleSettingsForm from "@/components/account-forms/RuleSettingsForm"
import RulesSection from "@/components/account-forms/RulesSection"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { FormSection } from "@/shared-module/components"

const pageCss = css`
  max-width: 1400px;
  display: grid;
  gap: var(--space-6);
`

/** Admin page for the account form rules and the log they are evaluated on. */
const AccountFormsPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("account-forms-title"))
  return (
    <div className={pageCss}>
      <h1>{t("account-forms-title")}</h1>
      <FormSection title={t("account-forms-rules-title")} headingLevel={2}>
        <RuleSettingsForm />
        <RulesSection />
      </FormSection>
      <FormSection title={t("account-forms-log-title")} headingLevel={2}>
        <DecisionsSection />
      </FormSection>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(AccountFormsPage))
