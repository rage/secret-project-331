"use client"

import { css } from "@emotion/css"
import { Trash } from "@vectopus/atlas-icons-react"
import { useTranslation } from "react-i18next"

import { useWorkspaceTaskCompletionField } from "../hooks/useWorkspaceTaskCompletionField"

import type { CourseDesignerPlanStageTask } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button, Checkbox } from "@/shared-module/components"

const taskRowStyles = css`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid ${baseTheme.colors.gray[100]};
  min-width: 0;

  :last-child {
    border-bottom: none;
  }
`

const taskRowCheckboxWrapperStyles = css`
  margin-bottom: 0;
  flex: 0 0 auto;
  width: auto;
  min-width: auto;
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
  flex: 1 1 0%;
  min-width: 0;
  display: block;
  min-height: 1.25rem;
  font-size: 0.95rem;
  line-height: 1.25;
  color: ${baseTheme.colors.gray[800]};
  overflow-wrap: break-word;
`

const taskTitleCompletedStyles = css`
  text-decoration: line-through;
  color: ${baseTheme.colors.gray[500]};
`

interface WorkspaceTaskRowProps {
  task: CourseDesignerPlanStageTask
  onToggle: (is_completed: boolean) => void
  onDelete: () => void
  isUpdating: boolean
  isDeleting: boolean
}

/** Single task row with completion checkbox and delete action. */
export default function WorkspaceTaskRow({
  task,
  onToggle,
  onDelete,
  isUpdating,
  isDeleting,
}: WorkspaceTaskRowProps) {
  const { t } = useTranslation()
  const { control } = useWorkspaceTaskCompletionField(task.is_completed, onToggle)

  return (
    <li className={`${taskRowStyles} ${taskRowWithHoverStyles}`}>
      <Checkbox
        name="isCompleted"
        control={control}
        label=""
        aria-label={task.title}
        isDisabled={isUpdating}
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
