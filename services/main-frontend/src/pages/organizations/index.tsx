import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import OrganizationsList from "../../components/page-specific/organizations/index/OrganizationsList"
import OnlyRenderIfPermissions from "../../shared-module/components/OnlyRenderIfPermissions"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

const MANAGE_EXERCISE_SERVICES_HREF = "/manage/exercise-services"
const SEARCH_USERS_HREF = "/manage/search-users"
const GLOBAL_PERMISSIONS_HREF = "/manage/permissions"
const GLOBAL_STATS_HREF = "/stats"

const OrganizationsPage: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  return (
    <>
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
      <OnlyRenderIfPermissions
        action={{ type: "view_user_progress_or_details" }}
        resource={{ type: "global_permissions" }}
      >
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
      <OnlyRenderIfPermissions
        action={{ type: "edit_role", variant: "Admin" }}
        resource={{ type: "global_permissions" }}
      >
        <div>
          <Link
            href={GLOBAL_PERMISSIONS_HREF}
            className={css`
              cursor: pointer;
              color: blue;
              text-decoration: underline;
            `}
          >
            {t("global-permissions")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions
        action={{ type: "view_stats" }}
        resource={{ type: "global_permissions" }}
      >
        <div>
          <Link
            href={GLOBAL_STATS_HREF}
            className={css`
              cursor: pointer;
              color: blue;
              text-decoration: underline;
            `}
          >
            {t("link-text-global-stats")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
    </>
  )
}

export default withErrorBoundary(OrganizationsPage)
