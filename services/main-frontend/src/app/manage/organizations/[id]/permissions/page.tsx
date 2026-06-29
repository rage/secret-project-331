"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import { PermissionPage } from "@/components/PermissionPage"
import { getOrganizationOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

const OrganizationPermissions: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const organization = useQuery({
    ...getOrganizationOptions({
      path: {
        organization_id: id,
      },
    }),
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
      <QueryResult query={organization}>
        {(data) => (
          <>
            <h1>
              {t("roles-for-organization")} {data.name}
            </h1>
            <PermissionPage
              domain={{
                // eslint-disable-next-line i18next/no-literal-string
                tag: "Organization",
                id: data.id,
              }}
            />
          </>
        )}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(OrganizationPermissions))
