import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import CourseList from "../../components/page-specific/org/organizationSlug/CourseList"
import OrganizationImageWidget from "../../components/page-specific/org/organizationSlug/OrganizationImageWidget"
import { fetchOrganizationExams } from "../../services/backend/exams"
import { fetchOrganizationBySlug } from "../../services/backend/organizations"
import DebugModal from "../../shared-module/components/DebugModal"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import { wideWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

interface OrganizationPageProps {
  query: SimplifiedUrlQuery<"organizationSlug">
}

const Organization: React.FC<OrganizationPageProps> = ({ query }) => {
  const { t } = useTranslation()
  const getOrganizationBySlug = useQuery(`organization-${query.organizationSlug}`, () =>
    fetchOrganizationBySlug(query.organizationSlug),
  )

  const exams = useQuery(
    [`organization-${query.organizationSlug}-exams`, getOrganizationBySlug.data],
    () => {
      if (getOrganizationBySlug.data) {
        return fetchOrganizationExams(getOrganizationBySlug.data.id)
      } else {
        // This should never happen, used for typescript because enabled boolean doesn't do type checking
        return Promise.reject(new Error("Organization ID undefined"))
      }
    },
    { enabled: !!getOrganizationBySlug.data },
  )

  return (
    // Removing frontPageUrl for some unsolved reason returns to organization front page rather than root
    <Layout frontPageUrl="/">
      <div className={wideWidthCenteredComponentStyles}>
        <h1>{t("title-organization-courses")}</h1>
        {(getOrganizationBySlug.isLoading || getOrganizationBySlug.isIdle) && (
          <Spinner variant={"medium"} />
        )}
        {getOrganizationBySlug.isError && (
          <ErrorBanner variant={"readOnly"} error={getOrganizationBySlug.error} />
        )}
        {getOrganizationBySlug.isSuccess && (
          <div>
            <OrganizationImageWidget
              organization={getOrganizationBySlug.data}
              onOrganizationUpdated={() => getOrganizationBySlug.refetch()}
            />
            <h2>{t("course-list")}</h2>
            {/* TODO: Implement perPage dropdown? */}
            <CourseList
              organizationId={getOrganizationBySlug.data.id}
              organizationSlug={query.organizationSlug}
              perPage={15}
            />
          </div>
        )}
        <h1>{t("organization-exams")}</h1>
        {(exams.isLoading || exams.isIdle) && <Spinner variant={"medium"} />}
        {exams.isError && <ErrorBanner variant={"readOnly"} error={exams.error} />}
        {exams.isSuccess &&
          exams.data.map((e) => (
            <div key={e.id}>
              <a href={`/org/${query.organizationSlug}/exams/${e.id}`}>{e.name}</a> ({e.course_name}
              ){" "}
              <a href={`/manage/exams/${e.id}`} aria-label={`${t("link-manage")} ${e.name}`}>
                {t("link-manage")}
              </a>
            </div>
          ))}
        <DebugModal data={getOrganizationBySlug.data} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Organization))
