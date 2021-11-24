import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import Link from "next/link"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useQueryClient } from "react-query"

import Layout from "../../../../components/Layout"
import NewCourseForm from "../../../../components/forms/NewCourseForm"
import UpdateCourseForm from "../../../../components/forms/UpdateCourseForm"
import CourseInstancesList from "../../../../components/lists/CourseInstancesList"
import CourseLanguageVersionsList, {
  formatQueryKey as formatLanguageVersionsQueryKey,
} from "../../../../components/lists/CourseLanguageVersionsList"
import ExerciseList from "../../../../components/lists/ExerciseList"
import {
  deleteCourse,
  getCourse,
  postNewCourseTranslation,
} from "../../../../services/backend/courses"
import { NewCourse } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { frontendWideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface ManageCoursePageProps {
  query: SimplifiedUrlQuery<"id">
}

const ManageCoursePage: React.FC<ManageCoursePageProps> = ({ query }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    isLoading,
    error,
    data: course,
    refetch,
  } = useQuery(`course-${query.id}`, () => getCourse(query.id))
  const [showForm, setShowForm] = useState(false)
  const [showNewLanguageVersionForm, setShowNewLanguageVersionForm] = useState(false)

  if (error) {
    return <ErrorBanner error={error} variant={"readOnly"} />
  }

  if (isLoading || !course) {
    return <div>{t("loading-text")}</div>
  }

  const handleOnDelete = async (courseId: string) => {
    await deleteCourse(courseId)
    await refetch()
  }

  const handleOnUpdateCourse = async () => {
    setShowForm(!showForm)
    await refetch()
  }

  const handleCreateNewLanguageVersion = async (newCourse: NewCourse) => {
    await postNewCourseTranslation(course.id, newCourse)
    await refetch()
    setShowNewLanguageVersionForm(false)
    queryClient.invalidateQueries(formatLanguageVersionsQueryKey(course.id))
  }

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${frontendWideWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>{course.name}</h1>
        <Button
          variant="secondary"
          size="medium"
          onClick={async () => await handleOnDelete(course.id)}
        >
          {t("button-text-delete")}
        </Button>
        <Button variant="primary" size="medium" onClick={() => setShowForm(!showForm)}>
          {t("edit")}
        </Button>
        <Dialog open={showForm} onClose={() => setShowForm(!showForm)}>
          <div
            className={css`
              margin: 1rem;
            `}
          >
            <Button variant="primary" size="medium" onClick={() => setShowForm(!showForm)}>
              {t("button-text-close")}
            </Button>
            <UpdateCourseForm
              courseId={query.id}
              courseName={course.name}
              onSubmitForm={handleOnUpdateCourse}
            />
          </div>
        </Dialog>
        <Dialog
          open={showNewLanguageVersionForm}
          onClose={() => setShowNewLanguageVersionForm(true)}
        >
          <div
            className={css`
              margin: 1rem;
            `}
          >
            <Button
              size="medium"
              variant="secondary"
              onClick={() => setShowNewLanguageVersionForm(false)}
            >
              {t("button-text-close")}
            </Button>
            <div>{t("create-new-language-version-of", { "course-name": course.name })}</div>
            <NewCourseForm
              organizationId={course.organization_id}
              onSubmitForm={handleCreateNewLanguageVersion}
            />
          </div>
        </Dialog>
        <br />
        <Link href={{ pathname: "/manage/courses/[id]/stats", query: { id: course.id } }}>
          {t("stats")}
        </Link>
        <br />
        <Link href={{ pathname: "/manage/courses/[id]/pages", query: { id: course.id } }}>
          {t("manage-pages")}
        </Link>
        <br />
        <Link
          href={{
            pathname: "/manage/courses/[id]/feedback",
            query: { id: course.id },
          }}
        >
          {t("manage-feedback")}
        </Link>
        <br />
        <Link
          href={{
            pathname: "/manage/courses/[id]/change-requests",
            query: { id: course.id },
          }}
        >
          {t("link-manage-change-requests")}
        </Link>

        <h2>{t("title-all-course-language-versions")}</h2>
        <CourseLanguageVersionsList courseId={query.id} />
        <Button size="medium" variant="primary" onClick={() => setShowNewLanguageVersionForm(true)}>
          {t("button-text-new")}
        </Button>
        <h2>{t("title-all-course-instances")}</h2>
        <CourseInstancesList courseId={query.id} />
        <h2>{t("title-all-exercises")}</h2>
        <ExerciseList courseId={query.id} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ManageCoursePage)),
)
