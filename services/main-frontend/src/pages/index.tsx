import { css } from "@emotion/css"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import MyCourses from "../components/page-specific/index/MyCourses"

import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import {
  allOrganizationsRoute,
  domainStatsRoute,
  globalPermissionsRoute,
  globalStatsRoute,
  manageExerciseServicesRoute,
  regradingsRoute,
  searchUsersRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const FrontPage = () => {
  const { t } = useTranslation()

  return (
    <div>
      <h1>{t("heading-text-welcome")}</h1>
      <h2
        className={css`
          margin-bottom: 0.5rem;
        `}
      >
        {t("heading-my-courses")}
      </h2>
      <MyCourses />

      <h2>{t("heading-navigation")}</h2>
      <div>
        <a href="https://www.mooc.fi">{t("link-text-find-more-courses")}</a>
      </div>
      <div>
        <Link
          href={allOrganizationsRoute()}
          className={css`
            cursor: pointer;
            color: blue;
            text-decoration: underline;
          `}
        >
          {t("link-text-all-organizations")}
        </Link>
      </div>

      <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link
            href={manageExerciseServicesRoute()}
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
            href={searchUsersRoute()}
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
            href={globalPermissionsRoute()}
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
            href={globalStatsRoute()}
            className={css`
              cursor: pointer;
              color: blue;
              text-decoration: underline;
            `}
          >
            {t("link-text-global-stats")}
          </Link>
        </div>
        <div>
          <Link
            href={domainStatsRoute()}
            className={css`
              cursor: pointer;
              color: blue;
              text-decoration: underline;
            `}
          >
            {t("domain-stats-link")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link
            href={regradingsRoute()}
            className={css`
              cursor: pointer;
              color: blue;
              text-decoration: underline;
            `}
          >
            {t("title-regradings")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(FrontPage))
