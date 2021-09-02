import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import { groupBy, max } from "lodash"
import React, { useState } from "react"
import { useQuery } from "react-query"

import ChapterImageWidget from "../../../../components/ChapterImageWidget"
import Layout from "../../../../components/Layout"
import NewChapterForm from "../../../../components/forms/NewChapterForm"
import PageList from "../../../../components/lists/PageList"
import { fetchCourseStructure } from "../../../../services/backend/courses"
import Button from "../../../../shared-module/components/Button"
import DebugModal from "../../../../shared-module/components/DebugModal"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import basePath from "../../../../shared-module/utils/base-path"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface CoursePagesProps {
  query: SimplifiedUrlQuery<"id">
}

const CoursePages: React.FC<CoursePagesProps> = ({ query }) => {
  const { id } = query
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

  const handleCreateChapter = async () => {
    setShowForm(!showForm)
    await refetch()
  }

  const pagesByChapter = groupBy(data.pages, "chapter_id")

  const maxPart = max(data.chapters.map((p) => p.chapter_number))

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>Course overview for {data.course.name}</h1>
        <PageList
          data={data.pages.filter((page) => !page.chapter_id)}
          refetch={refetch}
          courseId={data.course.id}
        />
        <div>
          {data.chapters
            .filter((chapter) => !chapter.deleted_at)
            .sort((a, b) => a.chapter_number - b.chapter_number)
            .map((chapter) => (
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
                <ChapterImageWidget chapter={chapter} onChapterUpdated={() => refetch()} />
                <PageList
                  data={pagesByChapter[chapter.id] ?? []}
                  refetch={refetch}
                  courseId={data.course.id}
                  chapter={chapter}
                />
              </div>
            ))}

          <Button variant="primary" size="medium" onClick={() => setShowForm(!showForm)}>
            Add new chapter
          </Button>

          <Dialog open={showForm} onClose={() => setShowForm(!showForm)}>
            <div
              className={css`
                margin: 1rem;
              `}
            >
              <Button variant="primary" size="medium" onClick={() => setShowForm(!showForm)}>
                Close
              </Button>
              <NewChapterForm
                courseId={data.course.id}
                onSubmitForm={handleCreateChapter}
                chapterNumber={(maxPart ?? 0) + 1}
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
