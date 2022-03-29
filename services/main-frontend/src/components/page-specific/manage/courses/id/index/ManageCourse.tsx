import { css } from "@emotion/css"
import { Dialog } from "@mui/material"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  QueryObserverResult,
  RefetchOptions,
  RefetchQueryFilters,
  useQueryClient,
} from "react-query"

import { deleteCourse, postNewCourseTranslation } from "../../../../../../services/backend/courses"
import { Course, NewCourse } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import NewCourseForm from "../../../../../forms/NewCourseForm"
import CourseCourseInstances from "../course-instances/CourseCourseInstances"
import ExerciseList from "../exercises/ExerciseList"
import CourseLanguageVersionsList, {
  formatLanguageVersionsQueryKey,
} from "../language-versions/CourseLanguageVersionsList"

import UpdateCourseForm from "./UpdateCourseForm"

interface Props {
  course: Course
  refetch: (
    options?: (RefetchOptions & RefetchQueryFilters<unknown>) | undefined,
  ) => Promise<QueryObserverResult<Course, unknown>>
}

const ManageCourse: React.FC<Props> = ({ course, refetch }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showNewLanguageVersionForm, setShowNewLanguageVersionForm] = useState(false)
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
    <>
      <h1>
        {course.name}
        {course.is_draft && ` (${t("draft")})`}
      </h1>
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
            courseId={course.id}
            courseName={course.name}
            isDraft={course.is_draft}
            isTest={course.is_test_mode}
            onSubmitForm={handleOnUpdateCourse}
          />
        </div>
      </Dialog>
      <Dialog open={showNewLanguageVersionForm} onClose={() => setShowNewLanguageVersionForm(true)}>
        <div
          className={css`
            margin: 1rem;
          `}
        >
          <div>{t("create-new-language-version-of", { "course-name": course.name })}</div>
          <NewCourseForm
            organizationId={course.organization_id}
            onSubmitNewCourseForm={handleCreateNewLanguageVersion}
            onClose={() => setShowNewLanguageVersionForm(false)}
          />
        </div>
      </Dialog>

      <h2>{t("title-all-course-language-versions")}</h2>
      <CourseLanguageVersionsList courseId={course.id} />
      <Button size="medium" variant="primary" onClick={() => setShowNewLanguageVersionForm(true)}>
        {t("button-text-new")}
      </Button>
      <CourseCourseInstances courseId={course.id} />
      <h2>{t("title-all-exercises")}</h2>
      <ExerciseList courseId={course.id} />
    </>
  )
}

export default ManageCourse
