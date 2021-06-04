import React, { useState } from "react"

import Layout from "../../../components/Layout"
import useQueryParameter from "../../../hooks/useQueryParameter"
import { useQuery } from "react-query"
import { dontRenderUntilQueryParametersReady } from "../../../utils/dontRenderUntilQueryParametersReady"
import { Button, Dialog } from "@material-ui/core"
import { CoursePart } from "../../../services/services.types"
import { postNewPage } from "../../../services/backend/pages"
import { fetchCourseStructure } from "../../../services/backend/courses"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import { css } from "@emotion/css"
import NewPartForm from "../../../components/forms/NewPartForm"

import DebugModal from "../../../components/DebugModal"
import PageList from "../../../components/PageList"
import { groupBy, max } from "lodash"
import { createBlockInstance } from "../../../utils/blockUtils"

const CoursePages: React.FC<unknown> = () => {
  const id = useQueryParameter("id")
  const { isLoading, error, data, refetch } = useQuery(`course-structure-${id}`, () =>
    fetchCourseStructure(id),
  )
  const [showForm, setShowForm] = useState(false)

  if (error) {
    return <div>Error overview.</div>
  }

  if (isLoading || !data) {
    return <div>Loading...</div>
  }

  const handleCreateFrontPage = async () => {
    const courseGrid = createBlockInstance("moocfi/course-grid")
    const courseProgress = createBlockInstance("moocfi/course-progress")
    await postNewPage({
      content: [courseGrid, courseProgress],
      url_path: "/",
      title: data.course.name,
      course_id: data.course.id,
      course_part_id: null,
    })
    await refetch()
  }

  const handleCreatePartFrontPage = async (part: CoursePart) => {
    const partsBlock = createBlockInstance("moocfi/pages-in-part")
    const exercisesInPart = createBlockInstance("moocfi/exercises-in-part")
    const coursePartProgress = createBlockInstance("moocfi/course-part-progress")
    await postNewPage({
      content: [partsBlock, exercisesInPart, coursePartProgress],
      url_path: `/part-${part.part_number}`,
      title: part.name,
      course_id: part.course_id,
      course_part_id: part.id,
      front_page_of_course_part_id: part.id,
    })
    await refetch()
  }

  const handleCreatePart = async () => {
    setShowForm(!showForm)
    await refetch()
  }

  const pagesByPart = groupBy(data.pages, "course_part_id")

  const maxPart = max(data.course_parts.map((p) => p.part_number))

  const frontPage = data.pages.find((page) => page.url_path === "/")

  return (
    <Layout>
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>Course overview for {data.course.name}</h1>
        {!frontPage && (
          <Button onClick={handleCreateFrontPage}>Create front page for course</Button>
        )}
        <PageList
          data={data.pages.filter((page) => !page.course_part_id)}
          refetch={refetch}
          courseId={id}
        />
        <div>
          {data.course_parts
            .filter((part) => !part.deleted_at)
            .sort((a, b) => a.part_number - b.part_number)
            .map((part: CoursePart) => (
              <div
                className={css`
                  border: 1px solid black;
                  padding: 2rem;
                  margin-bottom: 1rem;
                `}
                key={part.id}
              >
                <h3>
                  Part {part.part_number}: {part.name}
                </h3>
                {!part.page_id && (
                  <Button onClick={async () => await handleCreatePartFrontPage(part)}>
                    Create part front page
                  </Button>
                )}
                <PageList
                  data={pagesByPart[part.id] ?? []}
                  refetch={refetch}
                  courseId={id}
                  coursePart={part}
                />
              </div>
            ))}

          <Button onClick={() => setShowForm(!showForm)}>Add new part</Button>

          <Dialog open={showForm} onClose={() => setShowForm(!showForm)}>
            <div
              className={css`
                margin: 1rem;
              `}
            >
              <Button onClick={() => setShowForm(!showForm)}>Close</Button>
              <NewPartForm
                courseId={id}
                onSubmitForm={handleCreatePart}
                partNumber={maxPart + 1 || 1}
              />
            </div>
          </Dialog>
        </div>
      </div>

      <DebugModal data={data} />
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(CoursePages)
