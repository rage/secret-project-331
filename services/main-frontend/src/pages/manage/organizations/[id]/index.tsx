import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import OrganizationImageWidget from "../../../../components/page-specific/org/organizationSlug/OrganizationImageWidget"
import { fetchOrganization } from "../../../../services/backend/organizations"
import ErrorBanner from "../../../../shared-module/common/components/ErrorBanner"
import Spinner from "../../../../shared-module/common/components/Spinner"
import { withSignedIn } from "../../../../shared-module/common/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/common/utils/withErrorBoundary"

interface Props {
  query: SimplifiedUrlQuery<"id">
}

const ManageOrganization: React.FC<React.PropsWithChildren<Props>> = ({ query }) => {
  const { t } = useTranslation()
  const organization = useQuery({
    queryKey: [`organization-${query.id}`],
    queryFn: () => fetchOrganization(query.id),
  })

  let contents
  if (organization.isPending) {
    contents = <Spinner variant={"medium"} />
  } else if (organization.isError) {
    contents = <ErrorBanner error={organization.error} />
  } else {
    contents = (
      <>
        <h1>{organization.data.name}</h1>
        <OrganizationImageWidget
          organization={organization.data}
          onOrganizationUpdated={() => organization.refetch()}
        />
        <a href={`/manage/organizations/${organization.data.id}/permissions`}>
          {t("link-manage-permissions")}
        </a>
      </>
    )
  }

  return (
    <div
      className={css`
        margin-bottom: 1rem;
      `}
    >
      {contents}
    </div>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ManageOrganization)),
)
