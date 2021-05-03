import React, { useState } from "react"

import Layout from "../../../components/Layout"
import Link from "next/link"
import useQueryParameter from "../../../hooks/useQueryParameter"
import { useQuery } from "react-query"
import { dontRenderUntilQueryParametersReady } from "../../../utils/dontRenderUntilQueryParametersReady"
import { Button, Dialog } from "@material-ui/core"
import NewPageForm from "../../../components/forms/NewPageForm"
import { CoursePart, Page } from "../../../services/services.types"
import { deletePage, postNewPage } from "../../../services/backend/pages"
import { fetchCourseStructure } from "../../../services/backend/courses"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import { css } from "@emotion/css"
import NewPartForm from "../../../components/forms/NewPartForm"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTrash } from "@fortawesome/free-solid-svg-icons"

import styled from "@emotion/styled"
import DebugModal from "../../../components/DebugModal"
import PageList from "../../../components/PageList"
import { groupBy, max } from "lodash"

const DeleteButton = styled.button`
  border: 0;
  border: none;
  background-color: transparent;
  outline: none;
  cursor: pointer;
`

const CoursePages: React.FC<unknown> = () => {
  const id = useQueryParameter("id")
  const { isLoading, error, data, refetch } = useQuery(`course-structure-${id}`, () =>
    fetchCourseStructure(id),
  )
  const [showNewPageForm, setShowNewPageForm] = useState(false)
  const [showNewPartForm, setShowNewPartForm] = useState(false)

  if (error) {
    return <div>Error overview.</div>
  }

  if (isLoading || !data) {
    return <div>Loading...</div>
  }

  const handleDeleteTopLevelPage = async (pageId: string, name: string) => {
    const result = confirm(`Want to delete ${name}?`)
    if (result) {
      await deletePage(pageId)
      refetch()
    }
  }

  const handleCreateTopLevelPage = () => {
    setShowNewPageForm(!showNewPageForm)
    refetch()
  }

  const handleCreatePart = () => {
    setShowNewPartForm(!showNewPartForm)
    refetch()
  }

  const pagesByPart = groupBy(data.pages, "course_part_id")

  const maxPart = max(data.course_parts.map((p) => p.part_number))

  return (
    <Layout>
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>Course overview for {data.course.name}</h1>
        <PageList
          data={data.pages.filter((page) => !page.course_part_id)}
          refetch={refetch}
          courseId={id}
        />
        <div>
          {data.course_parts
            .filter((part) => !part.deleted)
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
                  <Button
                    onClick={async (_e) => {
                      await postNewPage({
                        content: [],
                        url_path: `/part-${part.part_number}`,
                        title: part.name,
                        course_id: part.course_id,
                        course_part_id: part.id,
                        front_page_of_course_part_id: part.id,
                      })
                      await refetch()
                    }}
                  >
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

          <Button onClick={() => setShowNewPartForm(!showNewPartForm)}>Add new part</Button>

          <Dialog open={showNewPartForm} onClose={() => setShowNewPartForm(!showNewPartForm)}>
            <div>
              <Button onClick={() => setShowNewPartForm(!showNewPartForm)}>Close</Button>
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
