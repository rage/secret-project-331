"use client"

import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer from "@/components/course-material/ContentRenderer"
import { Block } from "@/services/course-material/backend"
import { CourseMaterialExerciseTask } from "@/shared-module/common/bindings"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

export interface ExerciseAssignmentPreviewProps {
  tasks: CourseMaterialExerciseTask[]
}

/** Renders only the exercise instructions in a distinct reference box (no iframes/interactive parts). */
const ExerciseAssignmentPreview: React.FC<ExerciseAssignmentPreviewProps> = ({ tasks }) => {
  const { t } = useTranslation()
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => a.order_number - b.order_number),
    [tasks],
  )

  const tasksWithContent = useMemo(() => {
    // Treat a task as empty only when every block is an empty core/paragraph.
    // Other block types (e.g. headings) are not considered here and may need handling later.
    return sortedTasks.filter((task) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assignment = task.assignment as Block<any>[] | undefined
      if (!assignment?.length) {
        return false
      }
      const allEmpty = assignment.every(
        (p) =>
          p.name === "core/paragraph" &&
          (p.attributes as { content?: string })?.content?.trim() === "",
      )
      return !allEmpty
    })
  }, [sortedTasks])

  if (tasksWithContent.length === 0) {
    return null
  }

  return (
    <div
      className={css`
        background: ${baseTheme.colors.yellow[75]};
        border: 2px dashed ${baseTheme.colors.clear[400]};
        border-radius: 0.5rem;
        padding: 1.5rem 2rem;
        margin-bottom: 2rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      `}
    >
      <div
        className={css`
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: ${baseTheme.colors.gray[500]};
          margin-bottom: 0.75rem;
          font-family: ${headingFont};
        `}
      >
        {t("title-instructions")}
      </div>
      <div
        className={css`
          font-family: ${headingFont};
          color: ${baseTheme.colors.gray[700]};
        `}
      >
        <div
          className={css`
            & .assignment-text {
              p {
                font-size: 1rem;
                font-weight: 400;
                line-height: 1.6;
                margin-top: 0;
                margin-bottom: 0.75rem;
              }
              p:last-child {
                margin-bottom: 0;
              }
              li {
                font-size: 1rem;
                font-weight: 400;
                line-height: 1.6;
              }
            }
          `}
        >
          {tasksWithContent.map((task) => (
            <div key={task.id} className="assignment-text">
              <ContentRenderer
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data={task.assignment as Block<any>[]}
                isExam={false}
                dontAllowBlockToBeWiderThanContainerWidth={true}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ExerciseAssignmentPreview
