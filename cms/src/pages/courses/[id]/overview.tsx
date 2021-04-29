import React, { useState } from "react"

import Layout from "../../../components/Layout"
import Link from "next/link"
import useQueryParameter from "../../../hooks/useQueryParameter"
import { useQuery } from "react-query"
import { dontRenderUntilQueryParametersReady } from "../../../utils/dontRenderUntilQueryParametersReady"
import { Typography, Grid, Button } from "@material-ui/core"
import NewPageForm from "../../../components/forms/NewPageForm"
import { CoursePart, Page } from "../../../services/services.types"
import { deletePage } from "../../../services/backend/pages"
import { fetchCourseStructure } from "../../../services/backend/courses"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import { css } from "@emotion/css"
import NewPartForm from "../../../components/forms/NewPartForm"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPen, faTrash } from "@fortawesome/free-solid-svg-icons"

import styled from "@emotion/styled"
import { useRouter } from "next/router"

const DeleteButton = styled.button`
  color: red;
  border: 0;

  &:hover {
    cursor: pointer;
  }
`

const EditButton = styled.button`
  color: blue;
  border: 0;

  &:hover {
    cursor: pointer;
  }
`

const CoursePages: React.FC<unknown> = () => {
  const id = useQueryParameter("id")
  const { isLoading, error, data, refetch } = useQuery(`course-structure-${id}`, () =>
    fetchCourseStructure(id),
  )
  const [showNewPageForm, setShowNewPageForm] = useState(false)
  const [showNewPartForm, setShowNewPartForm] = useState(false)
  const router = useRouter()

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

  return (
    <Layout>
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        <Typography>
          Course overview for <b>{data.course.name}</b>
        </Typography>
        <Grid key={data.course.id} style={{ margin: "0.5em 0" }} container spacing={1}>
          <Grid item xs={4}>
            <h3>Path</h3>
          </Grid>
          <Grid item xs={6}>
            <h3>Title</h3>
          </Grid>
          <Grid item xs={1}>
            <h3>Edit</h3>
          </Grid>
          <Grid item xs={1}>
            <h3>Delete</h3>
          </Grid>
          {data.pages
            .filter((page) => !page.deleted)
            .map((page: Page) => (
              <>
                <Grid item xs={4}>
                  {page.url_path}
                </Grid>
                <Grid item xs={6}>
                  <Link href="/pages/[id]" as={`/pages/${page.id}`}>
                    {page.title}
                  </Link>
                </Grid>
                <Grid item xs={1}>
                  <EditButton onClick={() => router.push(`/pages/${page.id}`)}>
                    <FontAwesomeIcon icon={faPen} size="lg" />
                  </EditButton>
                </Grid>
                <Grid item xs={1}>
                  <DeleteButton onClick={() => handleDeleteTopLevelPage(page.id, page.title)}>
                    <FontAwesomeIcon icon={faTrash} size="lg" />
                  </DeleteButton>
                </Grid>
              </>
            ))}
        </Grid>
        {!showNewPageForm && (
          <Button onClick={() => setShowNewPageForm(!showNewPageForm)}>New top level page</Button>
        )}
        {showNewPageForm && (
          <div>
            <Button onClick={() => setShowNewPageForm(!showNewPageForm)}>Hide</Button>
            <NewPageForm courseId={id} onSubmitForm={handleCreateTopLevelPage} />
          </div>
        )}
        <div>
          {data.course_parts
            .filter((part) => !part.deleted)
            .map((part: CoursePart) => (
              <div key={part.id}>
                <p>{part.name}</p>
              </div>
            ))}
          {!showNewPartForm && (
            <Button onClick={() => setShowNewPartForm(!showNewPartForm)}>Add new part</Button>
          )}
          {showNewPartForm && (
            <div>
              <Button onClick={() => setShowNewPartForm(!showNewPartForm)}>Hide</Button>
              <NewPartForm courseId={id} onSubmitForm={handleCreatePart} />
            </div>
          )}
        </div>
      </div>
      <pre>{JSON.stringify(data, undefined, 2)}</pre>
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(CoursePages)
