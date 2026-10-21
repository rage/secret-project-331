"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { sendTeacherNewsletterEmail } from "@/generated/api/sdk.generated"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
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
import { Link } from "@/shared-module/components"

import MyCourses from "./MyCourses"

const FrontPage = () => {
  const { t } = useTranslation()
  usePageTitle(t("home"))

  const postTeacherNewsletterEmail = useToastMutation(
    async () => {
      await sendTeacherNewsletterEmail({})
    },
    { notify: true, method: "POST" }, // Muista sulkea useToastMutation-kutsun asetukset tarvittaessa
  )

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
        <Link href="https://www.mooc.fi">{t("link-text-find-more-courses")}</Link>
      </div>
      <OnlyRenderIfPermissions
        action={{ type: "create_courses_or_exams" }}
        resource={{ type: "any_course" }}
      >
        <div>
          <Link href="/manage/course-plans">{t("link-text-course-plans")}</Link>
        </div>
      </OnlyRenderIfPermissions>
      <div>
        <Link href={allOrganizationsRoute()}>{t("link-text-all-organizations")}</Link>
      </div>
      <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link href={manageExerciseServicesRoute()}>{t("link-manage-exercise-services")}</Link>
        </div>
      </OnlyRenderIfPermissions>

      <OnlyRenderIfPermissions
        action={{ type: "view_user_progress_or_details" }}
        resource={{ type: "global_permissions" }}
      >
        <div>
          <Link href={searchUsersRoute()}>{t("title-user-search")}</Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions
        action={{ type: "edit_role", variant: "Admin" }}
        resource={{ type: "global_permissions" }}
      >
        <div>
          <Link href={globalPermissionsRoute()}>{t("global-permissions")}</Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions
        action={{ type: "view_stats" }}
        resource={{ type: "global_permissions" }}
      >
        <div>
          <Link href={globalStatsRoute()}>{t("link-text-global-stats")}</Link>
        </div>
        <div>
          <Link href={domainStatsRoute()}>{t("domain-stats-link")}</Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link href={regradingsRoute()}>{t("title-regradings")}</Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions action={{ type: "view" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link href={chatbotCommandCenterRoute()}>{t("link-text-chatbot-command-center")}</Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions
        action={{ type: "administrate_credit_registrations" }}
        resource={{ type: "global_permissions" }}
      >
        <div>
          <Link href={creditRegistrationOverviewRoute()}>{t("title-credit-registration")}</Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions
        action={{ type: "administrate" }}
        resource={{ type: "global_permissions" }}
      >
        <div>
          <Link href="/manage/email-templates">{t("email-templates-title")}</Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link href={courseAuditingRoute()}>{t("link-course-auditing")}</Link>
        </div>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
        <div>
          <Link href="/external-courses">{t("external-courses")}</Link>
        </div>
      </OnlyRenderIfPermissions>
      <button onClick={() => postTeacherNewsletterEmail.mutate()}>Send Teacher Newsletter</button>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(FrontPage))
