import React, { useState } from "react"

import Layout from "../../../components/Layout"
import { fetchCourseStructure } from "../../../services/fetchData"
import { deletePage } from "../../../services/postData"
import Link from "next/link"
import useQueryParameter from "../../../hooks/useQueryParameter"
import { useQuery } from "react-query"
import { dontRenderUntilQueryParametersReady } from "../../../utils/dontRenderUntilQueryParametersReady"
import { Typography, Button, Grid } from "@material-ui/core"
import NewPage from "../../../components/NewPage"
import { Page } from "../../../services/services.types"

function CoursePages() {
  const id = useQueryParameter("id")
  const { isLoading, error, data, refetch } = useQuery(`course-structure-${id}`, () =>
    fetchCourseStructure(id),
  )
  const [showNewPageForm, setShowNewPageForm] = useState(false)

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

  return (
    <Layout>
      <Typography>Course pages for {id}</Typography>
      {!showNewPageForm && <Button onClick={handleShowingPageForm}>New page</Button>}
      {showNewPageForm && (
        <div>
          <NewPage courseId={id} />
          <Button onClick={handleShowingPageForm}>Hide</Button>
        </div>
      )}
      {data.pages
        .filter((page) => !page.deleted)
        .map((page: Page) => (
          <Grid key={page.id} style={{ margin: "0.5em" }} container spacing={1}>
            <Grid item xs={1}>
              <Link href="/pages/[id]" as={`/pages/${page.id}`}>
                <Button variant="outlined" color="primary">
                  Edit
                </Button>
              </Link>
            </Grid>
            <Grid item xs={2}>
              {page.url_path}
            </Grid>
            <Grid item xs={2}>
              {page.title}
            </Grid>
            <Grid item xs={2}>
              <Button onClick={() => handleDelete(page.id)} variant="outlined" color="secondary">
                Delete page
              </Button>
            </Grid>
          </Grid>
        ))}
      <pre>{JSON.stringify(data, undefined, 2)}</pre>
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(CoursePages)
