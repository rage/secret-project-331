"use client"

import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { CREDIT_REGISTRATION_NS } from "@/components/credit-registration/constants"
import { flushTabListCss } from "@/components/credit-registration/styles"
import type { RouteTabDefinition } from "@/components/Navigation/RouteTabList/RouteTab"
import { RouteTabList } from "@/components/Navigation/RouteTabList/RouteTabList"
import { RouteTabPageTitle } from "@/components/Navigation/RouteTabList/RouteTabPageTitle"
import {
  creditRegistrationLinkingEmailsRoute,
  creditRegistrationLinkingRoute,
} from "@/shared-module/common/utils/routes"

const KEY_OVERVIEW = "overview"
const KEY_EMAILS = "emails"

/** The Linking tab's sub-tabs: the overview, and the list of every linking email. */
const LinkingLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)

  const tabs = useMemo(
    (): RouteTabDefinition[] => [
      {
        key: KEY_OVERVIEW,
        title: t("credit-registration-tab-overview"),
        href: creditRegistrationLinkingRoute(),
      },
      {
        key: KEY_EMAILS,
        title: t("credit-registration-tab-linking-emails"),
        href: creditRegistrationLinkingEmailsRoute(),
      },
    ],
    [t],
  )

  return (
    <>
      <RouteTabPageTitle tabs={tabs} entityName={t("credit-registration-tab-linking")} order={21} />
      <RouteTabList tabs={tabs} className={flushTabListCss} />
      {children}
    </>
  )
}

export default LinkingLayout
