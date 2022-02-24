import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { css } from "@emotion/css"
import { Dialog } from "@mui/material"
import { groupBy, max } from "lodash"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { QueryObserverResult, RefetchOptions, RefetchQueryFilters } from "react-query"

import { CourseStructure } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import BreakFromCentered from "../../../../../../shared-module/components/Centering/BreakFromCentered"
import Centered from "../../../../../../shared-module/components/Centering/Centered"
import DebugModal from "../../../../../../shared-module/components/DebugModal"
import { baseTheme, typography } from "../../../../../../shared-module/styles"

import ChapterImageWidget from "./ChapterImageWidget"
import NewChapterForm from "./NewChapterForm"
import PageList from "./PageList"

export interface ManageCourseStructureProps {
  courseStructure: CourseStructure
  refetch: (
    options?: (RefetchOptions & RefetchQueryFilters<unknown>) | undefined,
  ) => Promise<QueryObserverResult<CourseStructure, unknown>>
}

const ManageCourseStructure: React.FC<ManageCourseStructureProps> = ({
  courseStructure,
  refetch,
}) => {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handleCreateChapter = async () => {
    setShowForm(!showForm)
    await refetch()
  }

  // eslint-disable-next-line i18next/no-literal-string
  const pagesByChapter = groupBy(courseStructure.pages, "chapter_id")

  const maxPart = max(courseStructure.chapters.map((p) => p.chapter_number))
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event) => {
        console.log("handleDragEnd")
        const { active, over } = event
        if (over && active.id !== over.id) {
          console.log("I shoud move here", { over, active })
        }
      }}
    >
      <h1>{t("course-pages-for", { "course-name": courseStructure.course.name })}</h1>
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
          .map((chapter, n) => (
            <BreakFromCentered key={chapter.id} sidebar={false}>
              <div
                className={css`
                  padding: 6rem 0;
                  background-color: ${n % 2 === 0 ? baseTheme.colors.clear[100] : "white"};
                `}
              >
                <Centered variant="default">
                  <h2
                    className={css`
                      font-size: ${typography.h3};
                      color: ${baseTheme.colors.grey[500]};
                      text-align: center;
                      text-transform: uppercase;
                      margin-bottom: 5rem;
                    `}
                  >
                    {t("title-chapter", {
                      "chapter-number": chapter.chapter_number,
                      "chapter-name": chapter.name,
                    })}
                  </h2>
                  <PageList
                    data={pagesByChapter[chapter.id] ?? []}
                    refetch={refetch}
                    courseId={courseStructure.course.id}
                    chapter={chapter}
                  />
                </Centered>
              </div>
            </BreakFromCentered>
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
    </DndContext>
  )
}

export default ManageCourseStructure
