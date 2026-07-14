"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import OrganizationsList from "./OrganizationsList"

import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const OrganizationsPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("organizations-heading"))
  return <OrganizationsList />
}

export default withErrorBoundary(OrganizationsPage)
