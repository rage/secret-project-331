import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import Link from "next/link"
import React, { useState } from "react"
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
  const id = useQueryParameter("id")

  const queryClient = useQueryClient()
  const { isLoading, error, data: course, refetch } = useQuery(`course-${id}`, () => getCourse(id))
  const [showForm, setShowForm] = useState(false)
  const [showNewLanguageVersionForm, setShowNewLanguageVersionForm] = useState(false)

  if (error) {
    return <div>Error fetching course data.</div>
  }

  if (isLoading || !course) {
    return <div>Loading...</div>
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
          Delete course
        </Button>
        <Button variant="primary" size="medium" onClick={() => setShowForm(!showForm)}>
          Edit course name
        </Button>
        <Dialog open={showForm} onClose={() => setShowForm(!showForm)}>
          <div
            className={css`
              margin: 1rem;
            `}
          >
            <Button variant="primary" size="medium" onClick={() => setShowForm(!showForm)}>
              Close
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
              Close
            </Button>
            <div>Create new language version of {course.name}</div>
            <NewCourseForm
              organizationId={course.organization_id}
              onSubmitForm={handleCreateNewLanguageVersion}
            />
          </div>
        </Dialog>
        <br />
        <Link href={{ pathname: "/manage/courses/[id]/stats", query: { id: course.id } }}>
          Stats
        </Link>
        <br />
        <Link href={{ pathname: "/manage/courses/[id]/pages", query: { id: course.id } }}>
          Manage pages
        </Link>
        <br />
        <Link
          href={{
            pathname: "/manage/courses/[id]/feedback",
            query: { id: course.id },
          }}
        >
          Manage feedback
        </Link>
        <h3>All course language versions</h3>
        <CourseLanguageVersionsList courseId={id} />
        <Button size="medium" variant="primary" onClick={() => setShowNewLanguageVersionForm(true)}>
          New language version
        </Button>
        <h3>All course instances</h3>
        <CourseInstancesList courseId={id} />
        <h3>All exercises</h3>
        <ExerciseList courseId={id} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ManageCoursePage)),
)
