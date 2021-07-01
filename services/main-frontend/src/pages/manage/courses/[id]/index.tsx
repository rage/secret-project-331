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
import ExerciseList from "../../../../components/ExerciseList"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"

const StatsPage: React.FC<unknown> = () => {
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
      <h3>All exercises</h3>
      <ExerciseList courseId={id} />
    </Layout>
  )
}

export default withSignedIn(dontRenderUntilQueryParametersReady(StatsPage))
