"use client"

import { css } from "@emotion/css"
import { Sliders } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import Tab from "@/components/Tabs/Tab"
import TabPanel from "@/components/Tabs/TabPanel"
import Tabs from "@/components/Tabs/Tabs"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const UserSettingsLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation()

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
          <Sliders
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
          {t("user-settings")}
        </h1>
      </div>

      <Tabs>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Tab tabName="account">{t("user-settings-account-tab")}</Tab>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Tab tabName="permissions">{t("user-settings-permissions-tab")}</Tab>
        <TabPanel>{children}</TabPanel>
      </Tabs>
    </div>
  )
}

export default UserSettingsLayout
