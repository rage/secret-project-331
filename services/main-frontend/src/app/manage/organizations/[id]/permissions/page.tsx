"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import { PermissionPage } from "@/components/PermissionPage"
import { fetchOrganization } from "@/services/backend/organizations"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const OrganizationPermissions: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const organization = useQuery({
    queryKey: [`organization-${id}`],
    queryFn: () => fetchOrganization(id),
  })

  return (
    <div
      className={css`
        margin-top: 40px;
        ${respondToOrLarger.sm} {
          margin-top: 80px;
        }
      `}
    >
      {organization.isLoading && <Spinner variant="large" />}
      {organization.isError && <ErrorBanner variant="readOnly" error={organization.error} />}
      {organization.isSuccess && (
        <>
          <h1>
            {t("roles-for-organization")} {organization.data.name}
          </h1>
          <PermissionPage
            domain={{
              // eslint-disable-next-line i18next/no-literal-string
              tag: "Organization",
              id: organization.data.id,
            }}
          />
        </>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(OrganizationPermissions))
