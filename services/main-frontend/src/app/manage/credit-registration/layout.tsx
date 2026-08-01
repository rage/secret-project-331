"use client"

import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import CreditRegistrationAlertBanner from "@/components/credit-registration/admin/CreditRegistrationAlertBanner"
import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import {
  creditRegistrationLinkingRoute,
  creditRegistrationOverviewRoute,
  creditRegistrationRegistrationsRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const KEY_OVERVIEW = "overview"
const KEY_REGISTRATIONS = "registrations"
const KEY_LINKING = "linking"

const headingCss = css`
  font-size: clamp(2rem, 3.6vh, 36px);
  color: ${baseTheme.colors.gray[700]};
  font-family: ${headingFont};
  font-weight: bold;
`

const CreditRegistrationLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation()

  const crumbs = useMemo(
    () => [
      {
        isLoading: false as const,
        label: t("title-credit-registration"),
        href: creditRegistrationOverviewRoute(),
      },
    ],
    [t],
  )
  useRegisterBreadcrumbs({ key: "credit-registration", order: 30, crumbs })

  const tabs = useMemo(
    (): RouteTabDefinition[] => [
      {
        key: KEY_OVERVIEW,
        title: t("credit-registration-tab-overview"),
        href: creditRegistrationOverviewRoute(),
      },
      {
        key: KEY_REGISTRATIONS,
        title: t("credit-registration-tab-registrations"),
        href: creditRegistrationRegistrationsRoute(),
        // The per-item detail pages live under this tab and must keep it selected.
        pathPrefix: creditRegistrationRegistrationsRoute(),
      },
      {
        key: KEY_LINKING,
        title: t("credit-registration-tab-linking"),
        href: creditRegistrationLinkingRoute(),
      },
    ],
    [t],
  )

  return (
    <>
      <h1 className={headingCss}>{t("title-credit-registration")}</h1>
      <RouteTabPageTitle tabs={tabs} entityName={null} order={20} />
      <CreditRegistrationAlertBanner />
      <RouteTabList tabs={tabs} />
      {children}
    </>
  )
}

export default withErrorBoundary(withSignedIn(CreditRegistrationLayout))
