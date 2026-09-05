"use client"

import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import {
  useCreditRegistrationAttentionCount,
  useCreditRegistrationMisconfiguredCourseCount,
  useCreditRegistrationUnhealthyPhaseCount,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import CreditRegistrationAlertBanner from "@/components/credit-registration/admin/CreditRegistrationAlertBanner"
import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import {
  creditRegistrationAuditRoute,
  creditRegistrationCoursesRoute,
  creditRegistrationErrorsRoute,
  creditRegistrationOverviewRoute,
  creditRegistrationRegistrationsRoute,
  creditRegistrationSystemRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const KEY_OVERVIEW = "overview"
const KEY_REGISTRATIONS = "registrations"
const KEY_ERRORS = "errors"
const KEY_COURSES = "courses"
const KEY_SYSTEM = "system"
const KEY_AUDIT = "audit"

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
        pathPrefix: creditRegistrationRegistrationsRoute(),
      },
      {
        key: KEY_ERRORS,
        title: t("credit-registration-tab-errors"),
        href: creditRegistrationErrorsRoute(),
        countHook: useCreditRegistrationAttentionCount,
      },
      {
        key: KEY_COURSES,
        title: t("credit-registration-tab-courses"),
        href: creditRegistrationCoursesRoute(),
        countHook: useCreditRegistrationMisconfiguredCourseCount,
      },
      {
        key: KEY_SYSTEM,
        title: t("credit-registration-tab-system"),
        href: creditRegistrationSystemRoute(),
        countHook: useCreditRegistrationUnhealthyPhaseCount,
      },
      {
        key: KEY_AUDIT,
        title: t("credit-registration-tab-audit"),
        href: creditRegistrationAuditRoute(),
      },
    ],
    [t],
  )

  return (
    <>
      <h1 className={headingCss}>{t("title-credit-registration")}</h1>
      <RouteTabPageTitle tabs={tabs} entityName={null} order={20} />
      <RouteTabList tabs={tabs} />
      <CreditRegistrationAlertBanner />
      {children}
    </>
  )
}

export default withErrorBoundary(withSignedIn(CreditRegistrationLayout))
