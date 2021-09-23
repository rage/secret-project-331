import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import { groupBy, max } from "lodash"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
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
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface CoursePagesProps {
  query: SimplifiedUrlQuery<"id">
}

const CoursePages: React.FC<CoursePagesProps> = ({ query }) => {
  const { t } = useTranslation()
  const { id } = query
  const { isLoading, error, data, refetch } = useQuery(`course-structure-${id}`, () =>
    fetchCourseStructure(id),
  )
  const [showForm, setShowForm] = useState(false)

  if (error) {
    return <div>{t("error-title")}</div>
  }

  if (isLoading || !data) {
    return <div>{t("loading-text")}</div>
  }

  const handleCreateChapter = async () => {
    setShowForm(!showForm)
    await refetch()
  }

  // eslint-disable-next-line i18next/no-literal-string
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
        <h1>{t("course-overview-for", { "course-name": data.course.name })}</h1>
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
                  {t("title-chapter", {
                    "chapter-number": chapter.chapter_number,
                    "chapter-name": chapter.name,
                  })}
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
            {t("button-text-new")}
          </Button>

          <Dialog open={showForm} onClose={() => setShowForm(!showForm)}>
            <div
              className={css`
                margin: 1rem;
              `}
            >
              <Button variant="primary" size="medium" onClick={() => setShowForm(!showForm)}>
                {t("button-text-close")}
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
