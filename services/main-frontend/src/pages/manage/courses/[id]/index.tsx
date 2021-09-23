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
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import { wideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import { dontRenderUntilQueryParametersReady } from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

const ManageCoursePage: React.FC<unknown> = () => {
  const { t } = useTranslation()
  const id = useQueryParameter("id")

  const queryClient = useQueryClient()
  const { isLoading, error, data: course, refetch } = useQuery(`course-${id}`, () => getCourse(id))
  const [showForm, setShowForm] = useState(false)
  const [showNewLanguageVersionForm, setShowNewLanguageVersionForm] = useState(false)

  if (error) {
    return <div>{t("error-title")}</div>
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
          ${wideWidthCenteredComponentStyles}
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
          {t("button-text-edit")}
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
              courseId={id}
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
        <h3>{t("title-all-course-language-versions")}</h3>
        <CourseLanguageVersionsList courseId={id} />
        <Button size="medium" variant="primary" onClick={() => setShowNewLanguageVersionForm(true)}>
          {t("button-text-new")}
        </Button>
        <h3>{t("title-all-course-instances")}</h3>
        <CourseInstancesList courseId={id} />
        <h3>{t("title-all-exercises")}</h3>
        <ExerciseList courseId={id} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ManageCoursePage)),
)
