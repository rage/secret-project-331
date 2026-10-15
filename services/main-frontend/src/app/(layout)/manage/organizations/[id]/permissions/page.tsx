"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { pageTitleCss } from "@/components/credit-registration/styles"
import { PermissionPage } from "@/components/PermissionPage"
import { getOrganizationOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"
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

  const crumbs = useMemo(() => [{ isLoading: false as const, label: t("link-permissions") }], [t])
  useRegisterBreadcrumbs({ key: `organization:${id}:permissions`, order: 30, crumbs })

  usePageTitle(joinTitleSegments([t("link-permissions"), organization.data?.name]))

  return (
    <div>
      <QueryResult query={organization}>
        {(data) => (
          <>
            <h1
              className={cx(
                pageTitleCss,
                css`
                  margin-bottom: var(--space-4);
                `,
              )}
            >
              {t("roles-for-organization")} {data.name || data.slug}
            </h1>
            <PermissionPage
              domain={{
                // oxlint-disable-next-line i18next/no-literal-string
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
