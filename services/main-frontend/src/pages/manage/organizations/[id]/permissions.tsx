import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { PermissionPage } from "../../../../components/PermissionPage"
import { fetchOrganization } from "../../../../services/backend/organizations"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface Props {
  query: SimplifiedUrlQuery<"id">
}

const OrganizationPermissions: React.FC<React.PropsWithChildren<Props>> = ({ query }) => {
  const { t } = useTranslation()
  const organization = useQuery({
    queryKey: [`organization-${query.id}`],
    queryFn: () => fetchOrganization(query.id),
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

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(OrganizationPermissions)),
)
