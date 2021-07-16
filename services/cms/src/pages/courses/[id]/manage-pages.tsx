import { css } from "@emotion/css"
import { Button, Dialog } from "@material-ui/core"
import { groupBy, max } from "lodash"
import React, { useState } from "react"
import { useQuery } from "react-query"

import Layout from "../../../components/Layout"
import PageList from "../../../components/PageList"
import NewPartForm from "../../../components/forms/NewChapterForm"
import { fetchCourseStructure } from "../../../services/backend/courses"
import { postNewPage } from "../../../services/backend/pages"
import { Chapter } from "../../../services/services.types"
import DebugModal from "../../../shared-module/components/DebugModal"
import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../../../shared-module/hooks/useQueryParameter"
import { dontRenderUntilQueryParametersReady } from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"

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
    await postNewPage({
      content: [],
      url_path: "/",
      title: data.course.name,
      course_id: data.course.id,
      chapter_id: null,
    })
    await refetch()
  }

  const handleCreateChapterFrontPage = async (chapter: Chapter) => {
    await postNewPage({
      content: [],
      url_path: `/chapter-${chapter.chapter_number}`,
      title: chapter.name,
      course_id: chapter.course_id,
      chapter_id: chapter.id,
      front_page_of_chapter_id: chapter.id,
    })
    await refetch()
  }

  const handleCreateChapter = async () => {
    setShowForm(!showForm)
    await refetch()
  }

  const pagesByChapter = groupBy(data.pages, "chapter_id")

  const maxPart = max(data.chapters.map((p) => p.chapter_number))

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
          data={data.pages.filter((page) => !page.chapter_id)}
          refetch={refetch}
          courseId={id}
        />
        <div>
          {data.chapters
            .filter((chapter) => !chapter.deleted_at)
            .sort((a, b) => a.chapter_number - b.chapter_number)
            .map((chapter: Chapter) => (
              <div
                className={css`
                  border: 1px solid black;
                  padding: 2rem;
                  margin-bottom: 1rem;
                `}
                key={chapter.id}
              >
                <h3>
                  Chapter {chapter.chapter_number}: {chapter.name}
                </h3>
                {!chapter.front_page_id && (
                  <Button onClick={async () => await handleCreateChapterFrontPage(chapter)}>
                    Create chapter front page
                  </Button>
                )}
                <PageList
                  data={pagesByChapter[chapter.id] ?? []}
                  refetch={refetch}
                  courseId={id}
                  chapter={chapter}
                />
              </div>
            ))}

          <Button onClick={() => setShowForm(!showForm)}>Add new chapter</Button>

          <Dialog open={showForm} onClose={() => setShowForm(!showForm)}>
            <div
              className={css`
                margin: 1rem;
              `}
            >
              <Button onClick={() => setShowForm(!showForm)}>Close</Button>
              <NewPartForm
                courseId={id}
                onSubmitForm={handleCreateChapter}
                chapterNumber={maxPart + 1 || 1}
              />
            </div>
          </Dialog>
        </div>
      </div>

      <DebugModal data={data} />
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(CoursePages)))
