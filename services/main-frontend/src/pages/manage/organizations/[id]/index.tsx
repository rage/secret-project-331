import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import OrganizationImageWidget from "../../../../components/page-specific/org/organizationSlug/OrganizationImageWidget"
import { fetchOrganization } from "../../../../services/backend/organizations"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { wideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface Props {
  query: SimplifiedUrlQuery<"id">
}

const ManageOrganization: React.FC<Props> = ({ query }) => {
  const { t } = useTranslation()
  const organization = useQuery(`organization-${query.id}`, () => fetchOrganization(query.id))

  let contents
  if (organization.isLoading || organization.isIdle) {
    contents = <Spinner variant={"medium"} />
  } else if (organization.isError) {
    contents = <ErrorBanner variant={"readOnly"} error={organization.error} />
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
    <Layout frontPageUrl={"/"} navVariant={"complex"}>
      <div
        className={css`
          ${wideWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        {contents}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ManageOrganization)),
)
