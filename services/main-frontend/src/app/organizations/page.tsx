"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import OrganizationsList from "./OrganizationsList"

const OrganizationsPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("organizations-heading"))
  return <OrganizationsList />
}

export default withErrorBoundary(OrganizationsPage)
