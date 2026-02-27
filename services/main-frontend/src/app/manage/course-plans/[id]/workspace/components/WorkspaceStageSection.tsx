"use client"

import { css, cx } from "@emotion/css"
import { Trash } from "@vectopus/atlas-icons-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  type CourseDesignerPlanStageTask,
  type CourseDesignerPlanStageWithTasks,
  createCourseDesignerStageTask,
  deleteCourseDesignerStageTask,
  updateCourseDesignerStageTask,
} from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"

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

const taskInputStyles = css`
  flex: 1;
  min-height: 2.25rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid ${baseTheme.colors.gray[300]};
  border-radius: 8px;
  font-size: 0.95rem;
  box-sizing: border-box;
`

const taskListStyles = css`
  list-style: none;
  padding: 0;
  margin: 0;
`

const taskRowStyles = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid ${baseTheme.colors.gray[100]};

  :last-child {
    border-bottom: none;
  }
`

const taskRowCheckboxWrapperStyles = css`
  margin-bottom: 0;
  flex-shrink: 0;
  display: flex;
  align-items: center;

  input[type="checkbox"] {
    transform: none;
  }
`

const taskRowWithHoverStyles = css`
  :hover .task-row-delete {
    opacity: 1;
  }
`

const taskDeleteButtonStyles = css`
  flex-shrink: 0;
  padding: 0.35rem;
  min-width: 0;
  opacity: 0;
  transition: opacity 120ms ease;
  color: ${baseTheme.colors.gray[500]};

  :hover {
    color: ${baseTheme.colors.crimson[600]};
  }

  @media (hover: none) {
    opacity: 1;
  }
`

const taskTitleStyles = css`
  flex: 1;
  display: inline-flex;
  align-items: center;
  min-height: 1.25rem;
  font-size: 0.95rem;
  line-height: 1.25;
  color: ${baseTheme.colors.gray[800]};
`

const taskTitleCompletedStyles = css`
  text-decoration: line-through;
  color: ${baseTheme.colors.gray[500]};
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

export default function WorkspaceStageSection({
  planId,
  stage,
  stageLabel,
  isActive,
  onInvalidate,
  showStageTitle = true,
}: WorkspaceStageSectionProps) {
  const { t } = useTranslation()
  const [newTaskTitle, setNewTaskTitle] = useState("")

  const createMutation = useToastMutation(
    (title: string) => createCourseDesignerStageTask(planId, stage.id, { title: title.trim() }),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setNewTaskTitle("")
        onInvalidate()
      },
    },
  )

  const updateMutation = useToastMutation(
    ({ taskId, is_completed }: { taskId: string; is_completed: boolean }) =>
      updateCourseDesignerStageTask(planId, taskId, { is_completed }),
    { notify: false },
    { onSuccess: onInvalidate },
  )

  const deleteMutation = useToastMutation(
    (taskId: string) => deleteCourseDesignerStageTask(planId, taskId),
    { notify: true, method: "DELETE" },
    { onSuccess: onInvalidate },
  )

  const handleAddTask = () => {
    const title = newTaskTitle.trim()
    if (!title) {
      return
    }
    createMutation.mutate(title)
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
      <div className={addRowStyles}>
        <input
          type="text"
          className={taskInputStyles}
          placeholder={t("course-plans-task-placeholder")}
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
        />
        <Button
          variant="secondary"
          size="medium"
          onClick={handleAddTask}
          disabled={createMutation.isPending || !newTaskTitle.trim()}
        >
          {t("course-plans-add-task")}
        </Button>
      </div>
      <ul className={taskListStyles}>
        {stage.tasks.length === 0 ? (
          <li className={emptyTasksStyles}>{t("course-plans-no-tasks")}</li>
        ) : (
          stage.tasks.map((task) => (
            <WorkspaceTaskRow
              key={task.id}
              task={task}
              onToggle={(is_completed) => updateMutation.mutate({ taskId: task.id, is_completed })}
              onDelete={() => deleteMutation.mutate(task.id)}
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

interface WorkspaceTaskRowProps {
  task: CourseDesignerPlanStageTask
  onToggle: (is_completed: boolean) => void
  onDelete: () => void
  isUpdating: boolean
  isDeleting: boolean
}

function WorkspaceTaskRow({
  task,
  onToggle,
  onDelete,
  isUpdating,
  isDeleting,
}: WorkspaceTaskRowProps) {
  const { t } = useTranslation()
  return (
    <li className={`${taskRowStyles} ${taskRowWithHoverStyles}`}>
      <CheckBox
        aria-label={task.title}
        checked={task.is_completed}
        label=""
        onChange={(e) => onToggle(e.target.checked)}
        disabled={isUpdating}
        className={taskRowCheckboxWrapperStyles}
      />
      <span
        className={css`
          ${taskTitleStyles}
          ${task.is_completed ? taskTitleCompletedStyles : ""}
        `}
      >
        {task.title}
      </span>
      <Button
        variant="secondary"
        size="small"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label={t("delete")}
        className={`${taskDeleteButtonStyles} task-row-delete`}
      >
        <Trash size={16} />
      </Button>
    </li>
  )
}
