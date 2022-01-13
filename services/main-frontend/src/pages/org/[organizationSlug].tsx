import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import router from "next/router"
import React, { useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import OrganizationImageWidget from "../../components/OrganizationImageWidget"
import { CourseComponent, CourseGrid } from "../../components/cards/CourseCard"
import NewCourseForm from "../../components/forms/NewCourseForm"
import { postNewCourse } from "../../services/backend/courses"
import { fetchOrganizationExams } from "../../services/backend/exams"
import {
  fetchOrganizationBySlug,
  fetchOrganizationCourseCount,
  fetchOrganizationCourses,
} from "../../services/backend/organizations"
import { NewCourse } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import DebugModal from "../../shared-module/components/DebugModal"
import Pagination from "../../shared-module/components/Pagination"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import { wideWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

interface OrganizationPageProps {
  query: SimplifiedUrlQuery<"organizationSlug">
}

const PAGE_LIMIT = 15
const NO_DESCRIPTION = "No description available"

const Organization: React.FC<OrganizationPageProps> = ({ query }) => {
  const [page, setPage] = useState(1)

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

  const {
    isLoading: isLoadingOrgCourses,
    error: errorOrgCourses,
    data: dataOrgCourses,
    refetch: refetchOrgCourses,
  } = useQuery(
    `organization-courses`,
    () => {
      if (dataOrg) {
        return fetchOrganizationCourses(dataOrg.id, page, PAGE_LIMIT)
      }
    },
    { enabled: !!dataOrg },
  )

  const {
    isLoading: isLoadingCourseCount,
    error: errorCourseCount,
    data: dataOrgCourseCount,
    refetch: refetchOrgCourseCount,
  } = useQuery(
    [`organization-courses-count`, query.organizationSlug],
    () => {
      if (dataOrg) {
        return fetchOrganizationCourseCount(dataOrg.id)
      }
    },
    { enabled: !!dataOrg },
  )

  useEffect(() => {
    const updateCourseList = async () => {
      await refetchOrgCourses()
    }
    updateCourseList()
  }, [page, dataOrgCourseCount, refetchOrgCourses])

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
      // eslint-disable-next-line i18next/no-literal-string
      manageHref={`/manage/courses/${course.id}`}
      // eslint-disable-next-line i18next/no-literal-string
      navigateToCourseHref={`/org/${query.organizationSlug}/courses/${course.slug}`}
    />
  ))

  return (
    // Removing frontPageUrl for some unsolved reason returns to organization front page rather than root
    <Layout frontPageUrl="/">
      <div className={wideWidthCenteredComponentStyles}>
        <h1>{t("title-organization-courses")}</h1>
        <OrganizationImageWidget
          organization={dataOrg}
          onOrganizationUpdated={() => refetchOrg()}
        />
        <h2>{t("course-list")}</h2>
        <CourseGrid>{courses}</CourseGrid>
        <br />
        <Pagination
          count={Math.ceil(Number(courseCount) / PAGE_LIMIT)}
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
              <NewCourseForm organizationId={dataOrg.id} onSubmitForm={handleSubmitNewCourse} />
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
              {t("button-text-create")}
            </Button>
            <br />
            <br />
          </>
        )}
        <h1>{t("organization-exams")}</h1>
        {exams.isSuccess &&
          exams.data &&
          exams.data.map((e) => (
            <div key={e.id}>
              <a href={`/org/${query.organizationSlug}/exams/${e.id}`}>{e.name}</a> ({e.course_name}
              ){" "}
              <a href={`/manage/exams/${e.id}`} aria-label={`${t("link-manage")} ${e.name}`}>
                {t("link-manage")}
              </a>
            </div>
          ))}
        {exams.isLoading && <div>{t("loading-text")}</div>}
        <DebugModal data={dataOrgCourses} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Organization))
