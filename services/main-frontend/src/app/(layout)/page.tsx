"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import {
  allOrganizationsRoute,
  chatbotCommandCenterRoute,
  courseAuditingRoute,
  creditRegistrationOverviewRoute,
  domainStatsRoute,
  globalPermissionsRoute,
  globalStatsRoute,
  manageExerciseServicesRoute,
  regradingsRoute,
  searchUsersRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import MyCourses from "./MyCourses"

const navLinkCss = css`
  cursor: pointer;
  color: blue;
  text-decoration: underline;
`

const FrontPage = () => {
  const { t } = useTranslation()
  usePageTitle(t("home"))

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
        <Link href="/manage/course-plans" className={navLinkCss}>
          {t("link-text-course-plans")}
        </Link>
      </div>
      <div>
        <Link href={allOrganizationsRoute()} className={navLinkCss}>
          {t("link-text-all-organizations")}
        </Link>
      </div>
      <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link href={manageExerciseServicesRoute()} className={navLinkCss}>
            {t("link-manage-exercise-services")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>

      <OnlyRenderIfPermissions
        action={{ type: "view_user_progress_or_details" }}
        resource={{ type: "global_permissions" }}
      >
        <div>
          <Link href={searchUsersRoute()} className={navLinkCss}>
            {t("title-user-search")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions
        action={{ type: "edit_role", variant: "Admin" }}
        resource={{ type: "global_permissions" }}
      >
        <div>
          <Link href={globalPermissionsRoute()} className={navLinkCss}>
            {t("global-permissions")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions
        action={{ type: "view_stats" }}
        resource={{ type: "global_permissions" }}
      >
        <div>
          <Link href={globalStatsRoute()} className={navLinkCss}>
            {t("link-text-global-stats")}
          </Link>
        </div>
        <div>
          <Link href={domainStatsRoute()} className={navLinkCss}>
            {t("domain-stats-link")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link href={regradingsRoute()} className={navLinkCss}>
            {t("title-regradings")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions action={{ type: "view" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link href={chatbotCommandCenterRoute()} className={navLinkCss}>
            {t("link-text-chatbot-command-center")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions
        action={{ type: "administrate" }}
        resource={{ type: "global_permissions" }}
      >
        <div>
          <Link href={creditRegistrationOverviewRoute()} className={navLinkCss}>
            {t("title-credit-registration")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link href={courseAuditingRoute()} className={navLinkCss}>
            {t("link-course-auditing")}
          </Link>
        </div>
      </OnlyRenderIfPermissions>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(FrontPage))
