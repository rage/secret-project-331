import { css } from "@emotion/css"
import { Dialog } from "@mui/material"
import { groupBy, max } from "lodash"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { QueryObserverResult, RefetchOptions, RefetchQueryFilters } from "react-query"

import { CourseStructure } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import DebugModal from "../../../../../../shared-module/components/DebugModal"

import ChapterImageWidget from "./ChapterImageWidget"
import NewChapterForm from "./NewChapterForm"
import PageList from "./PageList"

interface Props {
  courseStructure: CourseStructure
  refetch: (
    options?: (RefetchOptions & RefetchQueryFilters<unknown>) | undefined,
  ) => Promise<QueryObserverResult<CourseStructure, unknown>>
}

const ManageCourseStructure: React.FC<Props> = ({ courseStructure, refetch }) => {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const handleCreateChapter = async () => {
    setShowForm(!showForm)
    await refetch()
  }

  // eslint-disable-next-line i18next/no-literal-string
  const pagesByChapter = groupBy(courseStructure.pages, "chapter_id")

  const maxPart = max(courseStructure.chapters.map((p) => p.chapter_number))
  return (
    <>
      <h1>{t("course-overview-for", { "course-name": courseStructure.course.name })}</h1>
      <h2>{t("pages")}</h2>
      <PageList
        data={courseStructure.pages.filter((page) => !page.chapter_id)}
        refetch={refetch}
        courseId={courseStructure.course.id}
      />
      <h2>{t("chapters")}</h2>
      <div>
        {courseStructure.chapters
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
                courseId={courseStructure.course.id}
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
              courseId={courseStructure.course.id}
              onSubmitForm={handleCreateChapter}
              chapterNumber={(maxPart ?? 0) + 1}
            />
          </div>
        </Dialog>
      </div>
      <DebugModal data={courseStructure} />
    </>
  )
}

export default ManageCourseStructure
