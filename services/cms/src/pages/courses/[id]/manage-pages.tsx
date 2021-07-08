import React, { useState } from "react"

import Layout from "../../../components/Layout"
import useQueryParameter from "../../../shared-module/hooks/useQueryParameter"
import { useQuery } from "react-query"
import { dontRenderUntilQueryParametersReady } from "../../../utils/dontRenderUntilQueryParametersReady"
import { Button, Dialog } from "@material-ui/core"
import { Chapter } from "../../../services/services.types"
import { postNewPage } from "../../../services/backend/pages"
import { fetchCourseStructure } from "../../../services/backend/courses"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import { css } from "@emotion/css"
import NewPartForm from "../../../components/forms/NewChapterForm"

import DebugModal from "../../../components/DebugModal"
import PageList from "../../../components/PageList"
import { groupBy, max } from "lodash"
import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import CourseContext from "../../../contexts/CourseContext"

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
    <CourseContext.Provider value={{ courseInstanceId: data.course.id }}>
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
                  <Button>Add chapter image</Button>
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
    </CourseContext.Provider>
  )
}

export default withSignedIn(dontRenderUntilQueryParametersReady(CoursePages))
