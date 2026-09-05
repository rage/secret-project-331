"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import Tab from "@/components/Tabs/Tab"
import TabPanel from "@/components/Tabs/TabPanel"
import Tabs from "@/components/Tabs/Tabs"
import { getMyStudiesOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import { CREDIT_REGISTRATION_TAB, STUDIES_TAB } from "./constants"

const pageCss = css`
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  ${respondToOrLarger.md} {
    padding: 2.5rem 1.5rem;
  }
`

const titleCss = css`
  font-family: ${headingFont};
  font-weight: ${fontWeights.bold};
  font-size: 1.5rem;
  color: ${baseTheme.colors.gray[700]};
  margin: 0 0 1.75rem;
  letter-spacing: -0.01em;
  ${respondToOrLarger.md} {
    font-size: 1.75rem;
    margin-bottom: 2rem;
  }
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
      <h1 className={titleCss}>{t("profile")}</h1>

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
