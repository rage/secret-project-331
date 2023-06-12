import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import MainFrontendBreadCrumbs from "../../components/MainFrontendBreadCrumbs"
import CourseList from "../../components/page-specific/org/organizationSlug/CourseList"
import ExamList from "../../components/page-specific/org/organizationSlug/ExamList"
import useOrganizationQueryBySlug from "../../hooks/useOrganizationQueryBySlug"
import DebugModal from "../../shared-module/components/DebugModal"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import OnlyRenderIfPermissions from "../../shared-module/components/OnlyRenderIfPermissions"
import Spinner from "../../shared-module/components/Spinner"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

interface OrganizationPageProps {
  query: SimplifiedUrlQuery<"organizationSlug">
}

const Organization: React.FC<React.PropsWithChildren<OrganizationPageProps>> = ({ query }) => {
  const { t } = useTranslation()
  const organizationQuery = useOrganizationQueryBySlug(query.organizationSlug)

  return (
    <>
      <MainFrontendBreadCrumbs organizationSlug={query.organizationSlug} courseId={null} />
      <div>
        {organizationQuery.isSuccess && (
          <h1
            className={css`
              font-size: clamp(26px, 3vw, 30px);
              font-weight: 600;
            `}
          >
            {organizationQuery.data.name}
          </h1>
        )}
        {organizationQuery.isSuccess && (
          <a
            href={`/manage/organizations/${organizationQuery.data.id}`}
            aria-label={`${t("link-manage")}`}
          >
            {t("manage")}
          </a>
        )}
        {organizationQuery.isSuccess && (
          <>
            {organizationQuery.data.organization_image_url && (
              <img
                className={css`
                  max-width: 20rem;
                  max-height: 20rem;
                `}
                src={organizationQuery.data.organization_image_url}
                alt={t("image-alt-what-to-display-on-organization")}
              />
            )}
          </>
        )}
        {organizationQuery.isLoading && <Spinner variant={"medium"} />}
        {organizationQuery.isError && (
          <ErrorBanner variant={"readOnly"} error={organizationQuery.error} />
        )}
        {organizationQuery.isSuccess && (
          <>
            <h2
              className={css`
                font-size: clamp(26px, 3.6vw, 36px);
                margin-bottom: 10px;
              `}
            >
              {t("course-list")}
            </h2>
            {/* TODO: Implement perPage dropdown? */}
            <CourseList
              organizationId={organizationQuery.data.id}
              organizationSlug={query.organizationSlug}
            />

            {/* TODO: We should render ExamList once we can filter away exams etc. */}
            <OnlyRenderIfPermissions
              action={{ type: "create_courses_or_exams" }}
              resource={{ id: organizationQuery.data.id, type: "organization" }}
            >
              <h2>{t("exam-list")}</h2>
              <ExamList
                organizationId={organizationQuery.data.id}
                organizationSlug={query.organizationSlug}
              />
            </OnlyRenderIfPermissions>
          </>
        )}

        <DebugModal data={organizationQuery.data} />
      </div>
    </>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Organization))
