import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../components/Layout"
import CourseList from "../../components/page-specific/org/organizationSlug/CourseList"
import ExamList from "../../components/page-specific/org/organizationSlug/ExamList"
import { fetchOrganizationBySlug } from "../../services/backend/organizations"
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
  const getOrganizationBySlug = useQuery([`organization-${query.organizationSlug}`], () =>
    fetchOrganizationBySlug(query.organizationSlug),
  )

  return (
    <Layout>
      <div>
        {getOrganizationBySlug.isSuccess && <h1>{getOrganizationBySlug.data.name}</h1>}
        {getOrganizationBySlug.isSuccess && (
          <a
            href={`/manage/organizations/${getOrganizationBySlug.data.id}`}
            aria-label={`${t("link-manage")}`}
          >
            {t("manage")}
          </a>
        )}
        {getOrganizationBySlug.isSuccess && (
          <>
            {getOrganizationBySlug.data.organization_image_url && (
              <img
                className={css`
                  max-width: 20rem;
                  max-height: 20rem;
                `}
                src={getOrganizationBySlug.data.organization_image_url}
                alt={t("image-alt-what-to-display-on-organization")}
              />
            )}
            {!getOrganizationBySlug.data.organization_image_url && (
              <div>{t("no-organization-image")}</div>
            )}
          </>
        )}
        {getOrganizationBySlug.isLoading && <Spinner variant={"medium"} />}
        {getOrganizationBySlug.isError && (
          <ErrorBanner variant={"readOnly"} error={getOrganizationBySlug.error} />
        )}
        {getOrganizationBySlug.isSuccess && (
          <>
            <h2>{t("course-list")}</h2>
            {/* TODO: Implement perPage dropdown? */}
            <CourseList
              organizationId={getOrganizationBySlug.data.id}
              organizationSlug={query.organizationSlug}
            />

            {/* TODO: We should render ExamList once we can filter away exams etc. */}
            <OnlyRenderIfPermissions
              action={{ type: "create_courses_or_exams" }}
              resource={{ id: getOrganizationBySlug.data.id, type: "organization" }}
            >
              <h2>{t("exam-list")}</h2>
              <ExamList
                organizationId={getOrganizationBySlug.data.id}
                organizationSlug={query.organizationSlug}
              />
            </OnlyRenderIfPermissions>
          </>
        )}

        <DebugModal data={getOrganizationBySlug.data} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Organization))
