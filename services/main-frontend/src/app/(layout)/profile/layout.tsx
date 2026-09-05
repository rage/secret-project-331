"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { pageTitleCss } from "@/components/credit-registration/styles"
import Tab from "@/components/Tabs/Tab"
import TabPanel from "@/components/Tabs/TabPanel"
import Tabs from "@/components/Tabs/Tabs"
import { getMyStudiesOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import { CREDIT_REGISTRATION_TAB, STUDIES_TAB } from "./constants"

const pageCss = css`
  display: grid;
  gap: var(--space-4);
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4);
`

/**
 * Reserves the strip's height until `myStudies` says whether the second tab belongs here, so the
 * bar does not visibly grow a tab. Rendering the panel outside `Tabs` instead would remount it.
 */
const tabsNotDecidedYetCss = css`
  [role="tablist"] {
    visibility: hidden;
  }
`

const ProfileLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation()
  // Low baseline order so the nested tab pages, which register a higher order, win.
  usePageTitle(t("profile"), { order: 0 })

  // Same query key as the studies tab, so no extra request. Read directly rather than
  // through QueryResult: a failing tab list must not stop the tab content from rendering.
  const myStudies = useQuery({ ...getMyStudiesOptions() })
  const showCreditRegistrationTab = myStudies.data?.any_module_supports_credit_registration === true

  return (
    <div className={cx(pageCss, myStudies.isPending && tabsNotDecidedYetCss)}>
      <h1 className={pageTitleCss}>{t("profile")}</h1>

      <Tabs>
        <Tab tabName={STUDIES_TAB}>{t("profile-studies-tab")}</Tab>
        {showCreditRegistrationTab ? (
          <Tab tabName={CREDIT_REGISTRATION_TAB}>{t("profile-credit-registration-tab")}</Tab>
        ) : null}
        <TabPanel>{children}</TabPanel>
      </Tabs>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(ProfileLayout))
