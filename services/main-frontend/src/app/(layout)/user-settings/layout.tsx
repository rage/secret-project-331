"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { pageTitleCss } from "@/components/credit-registration/styles"
import { useIsInCreditRegistrationPipeline } from "@/components/credit-registration/useIsInCreditRegistrationPipeline"
import Tab from "@/components/Tabs/Tab"
import TabPanel from "@/components/Tabs/TabPanel"
import Tabs from "@/components/Tabs/Tabs"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const UserSettingsLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation()
  // Low baseline order: nested pages (account, permissions) register a higher order and win, and
  // this only shows for the section's redirect stub. Mirrors the course-material layout pattern.
  usePageTitle(t("user-settings"), { order: 0 })

  const showStudentNumberTab = useIsInCreditRegistrationPipeline() === true

  return (
    <div
      className={css`
        max-width: 800px;
        margin: 0 auto;
        padding: 1.5rem 1rem;
        ${respondToOrLarger.md} {
          padding: 2.5rem 1.5rem;
        }
      `}
    >
      <h1
        className={cx(
          pageTitleCss,
          css`
            margin-bottom: 1.75rem;
            ${respondToOrLarger.md} {
              margin-bottom: 2rem;
            }
          `,
        )}
      >
        {t("user-settings")}
      </h1>

      <Tabs>
        {/* oxlint-disable-next-line i18next/no-literal-string */}
        <Tab tabName="account">{t("user-settings-account-tab")}</Tab>
        {showStudentNumberTab ? (
          /* oxlint-disable-next-line i18next/no-literal-string */
          <Tab tabName="student-number">{t("user-settings-student-number-tab")}</Tab>
        ) : null}
        {/* oxlint-disable-next-line i18next/no-literal-string */}
        <Tab tabName="permissions">{t("user-settings-permissions-tab")}</Tab>
        <TabPanel>{children}</TabPanel>
      </Tabs>
    </div>
  )
}

export default UserSettingsLayout
