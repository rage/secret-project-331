import React, { useState } from "react"

import Layout from "../../../components/Layout"
import Link from "next/link"
import useQueryParameter from "../../../hooks/useQueryParameter"
import { useQuery } from "react-query"
import { dontRenderUntilQueryParametersReady } from "../../../utils/dontRenderUntilQueryParametersReady"
import { Typography, Button, Grid } from "@material-ui/core"
import NewPageForm from "../../../components/forms/NewPageForm"
import { CoursePart, Page } from "../../../services/services.types"
import { deletePage } from "../../../services/backend/pages"
import { fetchCourseStructure } from "../../../services/backend/courses"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import { css } from "@emotion/css"
import NewPartForm from "../../../components/forms/NewPartForm"

const CoursePages: React.FC<any> = () => {
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

  const handleShowingPageForm = () => {
    setShowNewPageForm(!showNewPageForm)
  }

  const handleDelete = async (pageId: string) => {
    await deletePage(pageId)
    refetch()
  }

  const handleCreateTopLevelPage = () => {
    setShowNewPageForm(!showNewPageForm)
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
          <Grid item xs={3}>
            <h3>Path</h3>
          </Grid>
          <Grid item xs={6}>
            <h3>Title</h3>
          </Grid>
          <Grid item xs={3}>
            &nbsp;
          </Grid>
          {data.pages
            .filter((page) => !page.deleted)
            .map((page: Page) => (
              <>
                <Grid item xs={3}>
                  {page.url_path}
                </Grid>
                <Grid item xs={6}>
                  <Link href="/pages/[id]" as={`/pages/${page.id}`}>
                    {page.title}
                  </Link>
                </Grid>
                <Grid item xs={3}>
                  <Button
                    onClick={() => handleDelete(page.id)}
                    variant="outlined"
                    color="secondary"
                  >
                    Delete
                  </Button>
                </Grid>
              </>
            ))}
        </Grid>
        {!showNewPageForm && <Button onClick={handleShowingPageForm}>New top level page</Button>}
        {showNewPageForm && (
          <div>
            <NewPageForm courseId={id} onSubmitForm={handleCreateTopLevelPage} />
            <Button onClick={handleShowingPageForm}>Hide</Button>
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
          {!showNewPartForm && <Button>Add new part</Button>}
          {showNewPartForm && (
            <div>
              <NewPartForm courseId={id} />
              <Button>Hide</Button>
            </div>
          )}
        </div>
      </div>
      <pre>{JSON.stringify(data, undefined, 2)}</pre>
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(CoursePages)
