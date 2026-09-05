"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { pageTitleCss, sectionsCss } from "@/components/credit-registration/styles"
import Tab from "@/components/Tabs/Tab"
import TabPanel from "@/components/Tabs/TabPanel"
import Tabs from "@/components/Tabs/Tabs"
import { getMyStudiesOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import { CREDIT_REGISTRATION_TAB, STUDIES_TAB } from "./constants"

// `Centered` pads horizontally only, so the page owns the space above the title.
const pageCss = cx(
  sectionsCss,
  css`
    padding-block: var(--space-5);
  `,
)

const ProfileLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation()
  // Low baseline order so the nested tab pages, which register a higher order, win.
  usePageTitle(t("profile"), { order: 0 })

  // Same query key as the studies tab, so no extra request. Read directly rather than
  // through QueryResult: a failing tab list must not stop the tab content from rendering.
  const myStudies = useQuery({ ...getMyStudiesOptions() })
  const showCreditRegistrationTab = myStudies.data?.any_module_supports_credit_registration === true

  return (
    <div className={pageCss}>
      <h1 className={pageTitleCss}>{t("profile")}</h1>

      {/* Hidden, not omitted: the bar must not visibly grow a tab, and rendering the panel
          outside `Tabs` to decide first would remount it. */}
      <Tabs isTabListHidden={myStudies.isPending}>
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
