"use client"

import { css, cx } from "@emotion/css"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import WorkspaceTaskRow from "./WorkspaceTaskRow"

import {
  createCourseDesignerStageTaskMutation,
  deleteCourseDesignerStageTaskMutation,
  updateCourseDesignerStageTaskMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { CourseDesignerPlanStageWithTasks } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import { Button, TextField } from "@/shared-module/components"

const cardStyles = css`
  background: white;
  border: 1px solid ${baseTheme.colors.gray[200]};
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
`

const headerStyles = css`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[800]};
  margin: 0 0 0.5rem 0;
`

const dateRowStyles = css`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[500]};
  margin-bottom: 0.5rem;
`

const dateRangeStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[500]};
`

const progressBlockStyles = css`
  margin-bottom: 1rem;
`

const progressLabelStyles = css`
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[500]};
  margin-bottom: 0.35rem;
`

const progressPercentStyles = css`
  color: ${baseTheme.colors.gray[500]};
`

const progressTrackStyles = css`
  height: 6px;
  border-radius: 999px;
  background: ${baseTheme.colors.gray[200]};
  overflow: hidden;
`

const progressFillStyles = css`
  height: 100%;
  border-radius: 999px;
  background: ${baseTheme.colors.green[600]};
  transition: width 200ms ease;
`

const criteriaBlockStyles = css`
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid ${baseTheme.colors.gray[200]};
`

const criteriaTitleStyles = css`
  font-size: 0.8rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[500]};
  margin: 0 0 0.4rem 0;
  text-transform: uppercase;
  letter-spacing: 0.02em;
`

const criteriaListStyles = css`
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[600]};
  line-height: 1.5;
`

const criteriaItemStyles = css`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0;
  padding-left: 0;
  position: relative;
  line-height: 1.25;

  ::before {
    content: "☐";
    flex-shrink: 0;
    width: 1.1em;
    font-size: 0.8rem;
    line-height: 1;
    color: ${baseTheme.colors.gray[500]};
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
`

const addRowStyles = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  align-items: center;

  @media (max-width: 30rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const taskFieldStyles = css`
  width: 100%;
`

const taskListStyles = css`
  list-style: none;
  padding: 0;
  margin: 0;
`

const emptyTasksStyles = css`
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.9rem;
  font-style: italic;
  padding: 0.5rem 0;
`

function formatPhaseTimeline(startsOn: string, endsOn: string): string {
  const s = new Date(startsOn)
  const e = new Date(endsOn)
  // eslint-disable-next-line i18next/no-literal-string
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  // eslint-disable-next-line i18next/no-literal-string
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`
}

interface WorkspaceStageSectionProps {
  planId: string
  stage: CourseDesignerPlanStageWithTasks
  stageLabel: string
  isActive: boolean
  onInvalidate: () => void
  showStageTitle?: boolean
}

const NEW_TASK_FIELD_NAME = "newTaskTitle" as const

export default function WorkspaceStageSection({
  planId,
  stage,
  stageLabel,
  isActive,
  onInvalidate,
  showStageTitle = true,
}: WorkspaceStageSectionProps) {
  const { t } = useTranslation()
  const {
    control: newTaskControl,
    setValue: setNewTaskValue,
    watch: watchNewTask,
  } = useForm<{
    newTaskTitle: string
  }>({
    defaultValues: { newTaskTitle: "" },
  })
  const newTaskTitle = watchNewTask(NEW_TASK_FIELD_NAME) ?? ""

  const createMutation = useToastMutationOptions(
    createCourseDesignerStageTaskMutation(),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setNewTaskValue(NEW_TASK_FIELD_NAME, "")
        onInvalidate()
      },
    },
  )

  const updateMutation = useToastMutationOptions(
    updateCourseDesignerStageTaskMutation(),
    { notify: false },
    { onSuccess: onInvalidate },
  )

  const deleteMutation = useToastMutationOptions(
    deleteCourseDesignerStageTaskMutation(),
    { notify: true, method: "DELETE" },
    { onSuccess: onInvalidate },
  )

  const handleAddTask = () => {
    const title = newTaskTitle.trim()
    if (!title) {
      return
    }
    createMutation.mutate({
      body: { title },
      path: { plan_id: planId, stage_id: stage.id },
    })
  }

  return (
    <div className={cardStyles}>
      {showStageTitle && (
        <h2 className={headerStyles}>
          {stageLabel}
          {isActive && (
            <span
              className={css`
                margin-left: 0.5rem;
                font-size: 0.85rem;
                font-weight: 500;
                color: ${baseTheme.colors.green[600]};
              `}
            >
              ({t("course-plans-status-in-progress")})
            </span>
          )}
        </h2>
      )}
      <div className={dateRowStyles}>
        <span>{t("course-plans-phase-timeline")}</span>
        <span className={dateRangeStyles}>
          {formatPhaseTimeline(stage.planned_starts_on, stage.planned_ends_on)}
        </span>
      </div>
      <div className={progressBlockStyles}>
        <div className={progressLabelStyles}>
          {t("course-plans-phase-progress", {
            completed: stage.tasks.filter((t) => t.is_completed).length,
            total: stage.tasks.length,
          })}
          {stage.tasks.length > 0 && (
            <span className={progressPercentStyles}>
              {" "}
              {t("course-plans-phase-progress-percent", {
                percent: Math.round(
                  (stage.tasks.filter((t) => t.is_completed).length / stage.tasks.length) * 100,
                ),
              })}
            </span>
          )}
        </div>
        <div className={progressTrackStyles}>
          <div
            className={cx(
              progressFillStyles,
              css({
                width: `${
                  stage.tasks.length > 0
                    ? (stage.tasks.filter((t) => t.is_completed).length / stage.tasks.length) * 100
                    : 0
                }%`,
              }),
            )}
          />
        </div>
      </div>
      <form
        className={addRowStyles}
        onSubmit={(e) => {
          e.preventDefault()
          handleAddTask()
        }}
      >
        <TextField
          id={`stage-task-input-${stage.id}`}
          name={NEW_TASK_FIELD_NAME}
          control={newTaskControl}
          label={t("course-plans-task-placeholder")}
          placeholder={t("course-plans-task-placeholder")}
          className={taskFieldStyles}
        />
        <Button
          type="submit"
          variant="secondary"
          size="medium"
          disabled={createMutation.isPending || !newTaskTitle.trim()}
        >
          {t("course-plans-add-task")}
        </Button>
      </form>
      <ul className={taskListStyles}>
        {stage.tasks.length === 0 ? (
          <li className={emptyTasksStyles}>{t("course-plans-no-tasks")}</li>
        ) : (
          stage.tasks.map((task) => (
            <WorkspaceTaskRow
              key={task.id}
              task={task}
              onToggle={(is_completed) =>
                updateMutation.mutate({
                  body: { is_completed },
                  path: { plan_id: planId, task_id: task.id },
                })
              }
              onDelete={() =>
                deleteMutation.mutate({
                  path: { plan_id: planId, task_id: task.id },
                })
              }
              isUpdating={updateMutation.isPending}
              isDeleting={deleteMutation.isPending}
            />
          ))
        )}
      </ul>
      <div className={criteriaBlockStyles}>
        <p className={criteriaTitleStyles}>{t("course-plans-phase-complete-when")}</p>
        <ul className={criteriaListStyles}>
          <li className={criteriaItemStyles}>{t("course-plans-phase-criteria-generic")}</li>
        </ul>
      </div>
    </div>
  )
}
