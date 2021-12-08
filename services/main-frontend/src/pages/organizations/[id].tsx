import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import router from "next/router"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import OrganizationImageWidget from "../../components/OrganizationImageWidget"
import { CourseComponent, CourseGrid } from "../../components/cards/CourseCard"
import NewCourseForm from "../../components/forms/NewCourseForm"
import { postNewCourse } from "../../services/backend/courses"
import {
  fetchOrganization,
  fetchOrganizationCourseCount,
  fetchOrganizationCourses,
} from "../../services/backend/organizations"
import { NewCourse } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import DebugModal from "../../shared-module/components/DebugModal"
import Pagination from "../../shared-module/components/Pagination"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import { frontendWideWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

interface OrganizationPageProps {
  query: SimplifiedUrlQuery<"id">
}

const PAGE_LIMIT = 5
const NO_DESCRIPTION = "No description available"

const Organization: React.FC<OrganizationPageProps> = ({ query }) => {
  const {
    isLoading: isLoadingOrgCourses,
    error: errorOrgCourses,
    data: dataOrgCourses,
    refetch: refetchOrgCourses,
  } = useQuery(`organization-courses`, () => fetchOrganizationCourses(query.id, page, PAGE_LIMIT))

  const [page, setPage] = useState(1)

  const {
    isLoading: isLoadingCourseCount,
    error: errorCourseCount,
    data: dataOrgCourseCount,
    refetch: refetchOrgCourseCount,
  } = useQuery([`organization-courses-count`, query.id], () =>
    fetchOrganizationCourseCount(query.id),
  )

  const { t } = useTranslation()
  const {
    isLoading: isLoadingOrg,
    error: errorOrg,
    data: dataOrg,
    refetch: refetchOrg,
  } = useQuery(`organization-${query.id}`, () => fetchOrganization(query.id))

  const loginStateContext = useContext(LoginStateContext)

  const [newCourseFormOpen, setNewCourseFormOpen] = useState(false)

  if (errorOrgCourses) {
    return <pre>{JSON.stringify(errorOrgCourses, undefined, 2)}</pre>
  }

  if (errorOrg) {
    return <pre>{JSON.stringify(errorOrg, undefined, 2)}</pre>
  }

  if (errorCourseCount) {
    return <pre>{JSON.stringify(errorCourseCount, undefined, 2)}</pre>
  }

  if (isLoadingOrgCourses || !dataOrgCourses || isLoadingOrg || !dataOrg) {
    return <>{t("loading-text")}</>
  }

  if (!dataOrgCourseCount || isLoadingCourseCount) {
    return <>{t("loading-text")}</>
  }

  const handleSubmitNewCourse = async (newCourse: NewCourse) => {
    await postNewCourse(newCourse)
    await refetchOrgCourses()
    await refetchOrgCourseCount()
    setNewCourseFormOpen(false)
  }

  const courseCount = dataOrgCourseCount.count
  const courses = dataOrgCourses.map((course) => (
    <CourseComponent
      key={course.id}
      title={course.name}
      description={course.description ?? NO_DESCRIPTION}
      languageCode={course.language_code}
      manageCourseManagementNavigation={(event) => {
        event.preventDefault()
        event.stopPropagation()
        // eslint-disable-next-line i18next/no-literal-string
        router.push(`/manage/courses/${course.id}`)
      }}
      manageCourseNavigation={(event) => {
        event.preventDefault()
        event.stopPropagation()
        // eslint-disable-next-line i18next/no-literal-string
        router.push(`/courses/${course.slug}`)
      }}
    />
  ))
  return (
    // Removing frontPageUrl for some unsolved reason returns to organization front page rather than root
    <Layout frontPageUrl="/">
      <div className={frontendWideWidthCenteredComponentStyles}>
        <h1>{t("title-organization-courses")}</h1>
        <OrganizationImageWidget
          organization={dataOrg}
          onOrganizationUpdated={() => refetchOrg()}
        />
        <h2>{t("courses", { courses: courseCount })}</h2>
        <CourseGrid>{courses}</CourseGrid>
        <br />
        <Pagination
          count={Math.ceil(courseCount / PAGE_LIMIT)}
          page={page}
          onChange={(_, pageNumber) => {
            router.replace(
              {
                query: {
                  ...router.query,
                  page: pageNumber,
                },
              },
              undefined,
              {},
            )
            setPage(pageNumber)
          }}
        />
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
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
              <NewCourseForm organizationId={query.id} onSubmitForm={handleSubmitNewCourse} />
            </div>
          </Dialog>
        </div>

        <br />
        {loginStateContext.signedIn && (
          <>
            <Button
              size="medium"
              variant="primary"
              onClick={() => setNewCourseFormOpen(!newCourseFormOpen)}
            >
              {t("button-text-new")}
            </Button>
            <br />
            <br />
          </>
        )}
        <DebugModal data={dataOrgCourses} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Organization))
