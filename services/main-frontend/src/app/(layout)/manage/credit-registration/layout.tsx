"use client"

import { css } from "@emotion/css"
import { usePathname } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import {
  useCreditRegistrationAttentionCount,
  useCreditRegistrationLinkingFailureCount,
  useCreditRegistrationMisconfiguredCourseCount,
  useCreditRegistrationUnhealthyPhaseCount,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import CreditRegistrationAlertBanner from "@/components/credit-registration/admin/CreditRegistrationAlertBanner"
import { pageTitleCss, sectionsCss } from "@/components/credit-registration/styles"
import { resolveActiveTab } from "@/components/Navigation/RouteTabList/resolveActiveTab"
import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import {
  creditRegistrationAuditRoute,
  creditRegistrationCoursesRoute,
  creditRegistrationErrorsRoute,
  creditRegistrationLinkingRoute,
  creditRegistrationOverviewRoute,
  creditRegistrationRegistrationsRoute,
  creditRegistrationSystemRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const KEY_OVERVIEW = "overview"
const KEY_REGISTRATIONS = "registrations"
const KEY_ERRORS = "errors"
const KEY_COURSES = "courses"
const KEY_LINKING = "linking"
const KEY_SYSTEM = "system"
const KEY_AUDIT = "audit"

// The shared tab list carries its own bottom margin; this shell's grid owns every gap instead.
const flushTabListCss = css`
  margin-bottom: 0;
`

const CreditRegistrationLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation()
  const pathname = usePathname()

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
        // oxlint-disable-next-line i18next/no-literal-string -- tone key, not user-facing text
        countTone: "danger",
      },
      {
        key: KEY_COURSES,
        title: t("credit-registration-tab-courses"),
        href: creditRegistrationCoursesRoute(),
        countHook: useCreditRegistrationMisconfiguredCourseCount,
      },
      {
        key: KEY_LINKING,
        title: t("credit-registration-tab-linking"),
        href: creditRegistrationLinkingRoute(),
        countHook: useCreditRegistrationLinkingFailureCount,
      },
      {
        key: KEY_SYSTEM,
        title: t("credit-registration-tab-system"),
        href: creditRegistrationSystemRoute(),
        countHook: useCreditRegistrationUnhealthyPhaseCount,
        // oxlint-disable-next-line i18next/no-literal-string -- tone key, not user-facing text
        countTone: "danger",
      },
      {
        key: KEY_AUDIT,
        title: t("credit-registration-tab-audit"),
        href: creditRegistrationAuditRoute(),
      },
    ],
    [t],
  )

  // The breadcrumb already says "Credit registration"; the heading says which of its pages this is.
  const activeTab = resolveActiveTab(tabs, pathname ?? "")
  // A registration's own page is matched via the Registrations tab's `pathPrefix`, but it has a
  // heading of its own (the student's name) — the tab title above it would only contradict it.
  const isTabOwnPage = activeTab !== undefined && pathname === activeTab.href

  return (
    <div className={sectionsCss}>
      <RouteTabPageTitle tabs={tabs} entityName={null} order={20} />
      <RouteTabList tabs={tabs} className={flushTabListCss} />
      {isTabOwnPage && <h1 className={pageTitleCss}>{activeTab.title}</h1>}
      <CreditRegistrationAlertBanner />
      {children}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CreditRegistrationLayout))
