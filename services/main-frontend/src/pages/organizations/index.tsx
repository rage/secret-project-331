import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../components/Layout"
import OrganizationsList from "../../components/page-specific/organizations/index/OrganizationsList"
import OnlyRenderIfPermissions from "../../shared-module/components/OnlyRenderIfPermissions"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

const MANAGE_EXERCISE_SERVICES_HREF = "/manage/exercise-services"
const SEARCH_USERS_HREF = "/manage/search-users"

const Home: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  return (
    <Layout>
      <OrganizationsList />

      <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link
            href={MANAGE_EXERCISE_SERVICES_HREF}
            className={css`
              cursor: pointer;
              color: blue;
              text-decoration: underline;
            `}
          >
            {t("link-manage-exercise-services")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions action={{ type: "teach" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link
            href={SEARCH_USERS_HREF}
            className={css`
              cursor: pointer;
              color: blue;
              text-decoration: underline;
            `}
          >
            {t("title-user-search")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
    </Layout>
  )
}

export default withErrorBoundary(Home)
