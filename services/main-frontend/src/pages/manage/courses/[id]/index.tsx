import React, { useState } from "react"

import Layout from "../../../../components/Layout"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import { dontRenderUntilQueryParametersReady } from "../../../../utils/dontRenderUntilQueryParametersReady"
import { normalWidthCenteredComponentStyles } from "../../../../styles/componentStyles"
import { css } from "@emotion/css"
import { useQuery } from "react-query"
import { deleteCourse, fetchCourseInstances, getCourse } from "../../../../services/backend/courses"
import { Dialog, Button } from "@material-ui/core"
import UpdateCourseForm from "../../../../components/forms/UpdateCourseForm"
import ExerciseList from "../../../../components/ExerciseList"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import Link from "next/link"

const ManageCoursePage: React.FC<unknown> = () => {
  const id = useQueryParameter("id")
  const {
    isLoading: loadingCourse,
    error: errorCourse,
    data: course,
    refetch: refetchCourse,
  } = useQuery(`course-${id}`, () => getCourse(id))
  const {
    isLoading: loadingCourseInstances,
    error: errorInstances,
    data: courseInstances,
    refetch: refetchCourseInstances,
  } = useQuery(`course-${id}-course-instances`, () => fetchCourseInstances(id))
  const [showForm, setShowForm] = useState(false)

  if (errorCourse || errorInstances) {
    return <div>Error fetching course data.</div>
  }

  if (loadingCourse || loadingCourseInstances || !courseInstances || !course) {
    return <div>Loading...</div>
  }

  const handleOnDelete = async (courseId: string) => {
    await deleteCourse(courseId)
    await refetchCourse()
  }

  const handleOnUpdateCourse = async () => {
    setShowForm(!showForm)
    await refetchCourse()
  }

  return (
    <Layout>
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>{course.name}</h1>
        <Button onClick={async () => await handleOnDelete(course.id)}>Delete course</Button>
        <Button onClick={() => setShowForm(!showForm)}>Edit course name</Button>
        <Dialog open={showForm} onClose={() => setShowForm(!showForm)}>
          <div
            className={css`
              margin: 1rem;
            `}
          >
            <Button onClick={() => setShowForm(!showForm)}>Close</Button>
            <UpdateCourseForm
              courseId={id}
              courseName={course.name}
              onSubmitForm={handleOnUpdateCourse}
            />
          </div>
        </Dialog>
      </div>
      <Link
        href={{
          pathname: "/manage/courses/[id]/stats",
          query: {
            id: course.id,
          },
        }}
      >
        Stats
      </Link>
      <a href={`/cms/courses/${course.id}/manage-pages`}>Manage pages</a>{" "}
      <h3>All course instances</h3>
      <ul>
        {courseInstances.map((instance) => {
          return (
            <li key={instance.id}>
              {instance?.name}{" "}
              <a href={`/cms/course-instances/${instance.id}/manage-emails`}>Manage e-mails</a>
            </li>
          )
        })}
      </ul>
      <h3>All exercises</h3>
      <ExerciseList courseId={id} />
    </Layout>
  )
}

export default withSignedIn(dontRenderUntilQueryParametersReady(ManageCoursePage))
