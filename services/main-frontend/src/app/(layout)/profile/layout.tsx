"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { Graduation } from "@vectopus/atlas-icons-react"
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

const ProfileLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation()
  // Low baseline order so the nested tab pages, which register a higher order, win.
  usePageTitle(t("profile"), { order: 0 })

  // Same query key as the studies tab, so no extra request. Read directly rather than
  // through QueryResult: a failing tab list must not stop the tab content from rendering.
  const myStudies = useQuery({ ...getMyStudiesOptions() })
  const showCreditRegistrationTab = myStudies.data?.any_module_supports_credit_registration === true

  return (
    <div
      className={css`
        max-width: 1100px;
        margin: 0 auto;
        padding: 1.5rem 1rem;
        ${respondToOrLarger.md} {
          padding: 2.5rem 1.5rem;
        }
      `}
    >
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 0.875rem;
          margin-bottom: 1.75rem;
          ${respondToOrLarger.md} {
            margin-bottom: 2rem;
          }
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            background: ${baseTheme.colors.green[100]};
            border-radius: 10px;
            flex-shrink: 0;
          `}
        >
          <Graduation
            size={24}
            className={css`
              color: ${baseTheme.colors.green[700]};
            `}
          />
        </div>
        <h1
          className={css`
            font-family: ${headingFont};
            font-weight: ${fontWeights.bold};
            font-size: 1.5rem;
            color: ${baseTheme.colors.gray[700]};
            margin: 0;
            letter-spacing: -0.01em;
            ${respondToOrLarger.md} {
              font-size: 1.75rem;
            }
          `}
        >
          {t("profile")}
        </h1>
      </div>

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
