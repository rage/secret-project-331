import React, { useState } from "react"

import Layout from "../../../../components/Layout"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import { dontRenderUntilQueryParametersReady } from "../../../../utils/dontRenderUntilQueryParametersReady"
import { normalWidthCenteredComponentStyles } from "../../../../styles/componentStyles"
import { css } from "@emotion/css"
import { useQuery } from "react-query"
import { deleteCourse, getCourse } from "../../../../services/backend/courses"
import { Dialog, Button } from "@material-ui/core"
import UpdateCourseForm from "../../../../components/forms/UpdateCourseForm"
import ExerciseList from "../../../../components/lists/ExerciseList"
import CourseInstancesList from "../../../../components/lists/CourseInstancesList"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import Link from "next/link"

const ManageCoursePage: React.FC<unknown> = () => {
  const id = useQueryParameter("id")
  const { isLoading, error, data: course, refetch } = useQuery(`course-${id}`, () => getCourse(id))
  const [showForm, setShowForm] = useState(false)

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
      <br />
      <a href={`/cms/courses/${course.id}/manage-pages`}>Manage pages</a>{" "}
      <h3>All course instances</h3>
      <CourseInstancesList courseId={id} />
      <h3>All exercises</h3>
      <ExerciseList courseId={id} />
    </Layout>
  )
}

export default withSignedIn(dontRenderUntilQueryParametersReady(ManageCoursePage))
