"use client"

import { css } from "@emotion/css"
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

const dateRangeStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[500]};
  margin-bottom: 1rem;
`

const addRowStyles = css`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`

const taskInputStyles = css`
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid ${baseTheme.colors.gray[300]};
  border-radius: 8px;
  font-size: 0.95rem;
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

const taskTitleStyles = css`
  flex: 1;
  font-size: 0.95rem;
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

function formatDateRange(startsOn: string, endsOn: string): string {
  const s = new Date(startsOn)
  const e = new Date(endsOn)
  // eslint-disable-next-line i18next/no-literal-string
  return `${s.toLocaleDateString()} – ${e.toLocaleDateString()}`
}

interface WorkspaceStageSectionProps {
  planId: string
  stage: CourseDesignerPlanStageWithTasks
  stageLabel: string
  isActive: boolean
  onInvalidate: () => void
}

export default function WorkspaceStageSection({
  planId,
  stage,
  stageLabel,
  isActive,
  onInvalidate,
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
      <p className={dateRangeStyles}>
        {formatDateRange(stage.planned_starts_on, stage.planned_ends_on)}
      </p>
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
    <li className={taskRowStyles}>
      <CheckBox
        checked={task.is_completed}
        onChange={(e) => onToggle(e.target.checked)}
        disabled={isUpdating}
      />
      <span
        className={css`
          ${taskTitleStyles}
          ${task.is_completed ? taskTitleCompletedStyles : ""}
        `}
      >
        {task.title}
      </span>
      <Button variant="secondary" size="small" onClick={onDelete} disabled={isDeleting}>
        {t("delete")}
      </Button>
    </li>
  )
}
