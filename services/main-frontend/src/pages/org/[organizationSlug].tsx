import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import Link from "next/link"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import OrganizationImageWidget from "../../components/OrganizationImageWidget"
import NewCourseForm from "../../components/forms/NewCourseForm"
import { postNewCourse } from "../../services/backend/courses"
import { fetchOrganizationExams } from "../../services/backend/exams"
import {
  fetchOrganizationBySlug,
  fetchOrganizationCoursesBySlug,
} from "../../services/backend/organizations"
import { NewCourse } from "../../shared-module/bindings"
import { isErrorResponse } from "../../shared-module/bindings.guard"
import Button from "../../shared-module/components/Button"
import DebugModal from "../../shared-module/components/DebugModal"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import { frontendWideWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { courseMaterialPageHref } from "../../shared-module/utils/cross-routing"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

interface OrganizationPageProps {
  query: SimplifiedUrlQuery<"organizationSlug">
}

const Organization: React.FC<OrganizationPageProps> = ({ query }) => {
  const {
    isLoading: isLoadingOrgCourses,
    error: errorOrgCourses,
    data: dataOrgCourses,
    refetch: refetchOrgCourses,
  } = useQuery(`organization-${query.organizationSlug}-courses`, () =>
    fetchOrganizationCoursesBySlug(query.organizationSlug),
  )
  const { t } = useTranslation()
  const {
    isLoading: isLoadingOrg,
    error: errorOrg,
    data: dataOrg,
    refetch: refetchOrg,
  } = useQuery(`organization-${query.organizationSlug}`, () =>
    fetchOrganizationBySlug(query.organizationSlug),
  )
  const exams = useQuery(
    [`organization-${query.organizationSlug}-exams`, dataOrg],
    () => {
      if (dataOrg) {
        return fetchOrganizationExams(dataOrg.id)
      }
    },
    { enabled: !!dataOrg },
  )
  const loginStateContext = useContext(LoginStateContext)

  const [newCourseFormOpen, setNewCourseFormOpen] = useState(false)
  if (errorOrgCourses) {
    return <pre>{JSON.stringify(errorOrgCourses, undefined, 2)}</pre>
  }

  if (errorOrg) {
    return <pre>{JSON.stringify(errorOrg, undefined, 2)}</pre>
  }

  if (exams.isError) {
    return <pre>{JSON.stringify(exams.error, undefined, 2)}</pre>
  }

  if (isLoadingOrgCourses || !dataOrgCourses || isLoadingOrg || !dataOrg) {
    return <>{t("loading-text")}</>
  }

  const handleSubmitNewCourse = async (newCourse: NewCourse) => {
    await postNewCourse(newCourse)
    await refetchOrgCourses()
    setNewCourseFormOpen(false)
  }

  return (
    // Removing frontPageUrl for some unsolved reason returns to organization front page rather than root
    <Layout frontPageUrl="/">
      <div className={frontendWideWidthCenteredComponentStyles}>
        <h1>{t("title-organization-courses")}</h1>
        <OrganizationImageWidget
          organization={dataOrg}
          onOrganizationUpdated={() => refetchOrg()}
        />
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
          {dataOrgCourses.map((course) => (
            <div key={course.id}>
              <a href={courseMaterialPageHref(query.organizationSlug, course.slug)}>
                {course.name}
              </a>{" "}
              {loginStateContext.signedIn && (
                <>
                  <Link
                    href={{
                      pathname: "/manage/courses/[id]",
                      query: {
                        id: course.id,
                      },
                    }}
                  >
                    {t("link-manage")}
                  </Link>{" "}
                </>
              )}
            </div>
          ))}
        </div>

        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
          {loginStateContext.signedIn && (
            <Button
              size="medium"
              variant="primary"
              onClick={() => setNewCourseFormOpen(!newCourseFormOpen)}
            >
              {t("button-text-create")}
            </Button>
          )}

          <Dialog open={newCourseFormOpen} onClose={() => setNewCourseFormOpen(!newCourseFormOpen)}>
            <div
              className={css`
                margin: 1rem;
              `}
            >
              <Button
                size="medium"
                variant="secondary"
                onClick={() => setNewCourseFormOpen(!newCourseFormOpen)}
              >
                {t("button-text-close")}
              </Button>
              <NewCourseForm organizationId={dataOrg.id} onSubmitForm={handleSubmitNewCourse} />
            </div>
          </Dialog>
        </div>
        <h1>{t("organization-exams")}</h1>
        {exams.isSuccess &&
          exams.data &&
          exams.data.map((e) => (
            <div key={e.id}>
              <a href={`/org/${query.organizationSlug}/exams/${e.id}`}>{e.name}</a> ({e.course_name}
              ) <a href={`/manage/exams/${e.id}`}>{t("link-manage")}</a>
            </div>
          ))}
        {exams.isLoading && <div>{t("loading-text")}</div>}
        <DebugModal data={dataOrgCourses} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Organization))
