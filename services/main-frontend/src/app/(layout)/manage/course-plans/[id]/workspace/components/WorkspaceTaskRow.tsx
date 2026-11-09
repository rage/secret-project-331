"use client"

import { css, cx } from "@emotion/css"
import { Pencil, Trash } from "@vectopus/atlas-icons-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type {
  CourseDesignerPlanStageTask,
  PlanMemberWithDetails,
} from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import {
  Badge,
  Button,
  Checkbox,
  Select,
  TextArea,
  TextField,
  TONE,
} from "@/shared-module/components"

import { formatPlanMemberName } from "../../../coursePlanMembers"
import { useWorkspaceTaskCompletionField } from "../hooks/useWorkspaceTaskCompletionField"

const taskRowStyles = css`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0;
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

const taskRowActionsStyles = css`
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 120ms ease;

  @media (hover: none) {
    opacity: 1;
  }
`

const taskRowWithHoverStyles = css`
  :hover .task-row-actions,
  :focus-within .task-row-actions {
    opacity: 1;
  }
`

const taskActionButtonStyles = css`
  padding: 0.35rem;
  min-width: 0;
  color: ${baseTheme.colors.gray[500]};
`

const taskDeleteButtonStyles = css`
  :hover {
    color: ${baseTheme.colors.crimson[600]};
  }
`

const taskContentStyles = css`
  flex: 1 1 0%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`

const taskTitleStyles = css`
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

const taskDescriptionStyles = css`
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: ${baseTheme.colors.gray[600]};
  white-space: pre-wrap;
  overflow-wrap: break-word;
`

const taskMetaStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
`

const editFormStyles = css`
  flex: 1 1 0%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.25rem 0 0.5rem;
`

const editActionsStyles = css`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
`

const UNASSIGNED = ""
const TITLE_FIELD = "title" as const

interface TaskEditFormValues {
  title: string
  description: string
  assigneeUserId: string
}

/** Fields of a task edit that changed; absent fields stay as they are. */
export interface TaskChanges {
  title?: string
  /** An empty string clears the description. */
  description?: string
  /** `null` unassigns the task. */
  assigneeUserId?: string | null
}

interface WorkspaceTaskRowProps {
  task: CourseDesignerPlanStageTask
  members: PlanMemberWithDetails[]
  onToggle: (is_completed: boolean) => void
  onDelete: () => void
  /** Saves an edit; rejects when the save fails so the editor stays open. */
  onSave: (changes: TaskChanges) => Promise<void>
  isUpdating: boolean
  isDeleting: boolean
}

/** One task: completion checkbox, details, and an inline editor for title, description and assignee. */
export default function WorkspaceTaskRow({
  task,
  members,
  onToggle,
  onDelete,
  onSave,
  isUpdating,
  isDeleting,
}: WorkspaceTaskRowProps) {
  const { t } = useTranslation()
  const { control: completionControl } = useWorkspaceTaskCompletionField(
    task.is_completed,
    onToggle,
  )
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const editFormRef = useRef<HTMLFormElement>(null)
  const shouldRestoreFocusRef = useRef(false)

  const { control, handleSubmit, reset, setFocus, watch } = useForm<TaskEditFormValues>({
    defaultValues: toFormValues(task),
  })
  const title = watch("title") ?? ""

  useEffect(() => {
    if (isEditing) {
      setFocus(TITLE_FIELD)
    } else if (shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false
      editButtonRef.current?.focus()
    }
  }, [isEditing, setFocus])

  useEffect(() => {
    const form = editFormRef.current
    if (!isEditing || form === null) {
      return
    }
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.stopPropagation()
        shouldRestoreFocusRef.current = true
        setIsEditing(false)
      }
    }
    form.addEventListener("keydown", cancelOnEscape)
    return () => form.removeEventListener("keydown", cancelOnEscape)
  }, [isEditing])

  const assignee = members.find((member) => member.user_id === task.assignee_user_id) ?? null

  const assigneeOptions = [
    { value: UNASSIGNED, label: t("course-plans-task-unassigned") },
    ...members.map((member) => ({
      value: member.user_id,
      label: formatPlanMemberName(member),
    })),
  ]

  const startEditing = () => {
    reset(toFormValues(task))
    setIsEditing(true)
  }

  const stopEditing = () => {
    shouldRestoreFocusRef.current = true
    setIsEditing(false)
  }

  const submitEdit = handleSubmit(async (values) => {
    const changes: TaskChanges = {}
    const nextTitle = values.title.trim()
    const nextDescription = values.description.trim()
    const nextAssignee = values.assigneeUserId === UNASSIGNED ? null : values.assigneeUserId
    if (nextTitle !== task.title) {
      changes.title = nextTitle
    }
    if (nextDescription !== (task.description ?? "")) {
      changes.description = nextDescription
    }
    if (nextAssignee !== (task.assignee_user_id ?? null)) {
      changes.assigneeUserId = nextAssignee
    }
    if (Object.keys(changes).length === 0) {
      stopEditing()
      return
    }
    setIsSaving(true)
    try {
      await onSave(changes)
      stopEditing()
    } catch {
      // The failed request already showed an error toast; keep the editor open for a retry.
    } finally {
      setIsSaving(false)
    }
  })

  if (isEditing) {
    return (
      <li className={taskRowStyles}>
        <form
          className={editFormStyles}
          aria-label={t("course-plans-task-edit-form-label", { task: task.title })}
          ref={editFormRef}
          onSubmit={(event) => void submitEdit(event)}
        >
          <TextField
            id={`task-${task.id}-title`}
            name="title"
            control={control}
            label={t("course-plans-task-title-label")}
            isRequired
            maxLength={255}
            isDisabled={isSaving}
          />
          <TextArea
            id={`task-${task.id}-description`}
            name="description"
            control={control}
            label={t("course-plans-task-description-label")}
            description={t("course-plans-task-description-hint")}
            rows={3}
            autoResize
            isDisabled={isSaving}
          />
          <Select
            id={`task-${task.id}-assignee`}
            name="assigneeUserId"
            control={control}
            label={t("course-plans-task-assignee-label")}
            options={assigneeOptions}
            isDisabled={isSaving}
          />
          <div className={editActionsStyles}>
            <Button variant="secondary" size="small" onClick={stopEditing} disabled={isSaving}>
              {t("button-text-cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="small"
              disabled={isSaving || title.trim().length === 0}
              isLoading={isSaving}
            >
              {t("button-text-save")}
            </Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className={cx(taskRowStyles, taskRowWithHoverStyles)}>
      <Checkbox
        name="isCompleted"
        control={completionControl}
        label=""
        aria-label={task.title}
        isDisabled={isUpdating}
        className={taskRowCheckboxWrapperStyles}
      />
      <div className={taskContentStyles}>
        <span className={cx(taskTitleStyles, task.is_completed && taskTitleCompletedStyles)}>
          {task.title}
        </span>
        {task.description && <p className={taskDescriptionStyles}>{task.description}</p>}
        {(assignee !== null || task.is_auto_generated) && (
          <div className={taskMetaStyles}>
            {assignee !== null && (
              <Badge tone={TONE.INFO} size="compact">
                {t("course-plans-task-assigned-to", { name: formatPlanMemberName(assignee) })}
              </Badge>
            )}
            {task.is_auto_generated && (
              <Badge
                tone={TONE.NEUTRAL}
                size="compact"
                description={t("course-plans-task-default-description")}
              >
                {t("course-plans-task-default")}
              </Badge>
            )}
          </div>
        )}
      </div>
      <div className={cx(taskRowActionsStyles, "task-row-actions")}>
        <Button
          ref={editButtonRef}
          variant="secondary"
          size="small"
          onClick={startEditing}
          aria-label={t("course-plans-task-edit", { task: task.title })}
          className={taskActionButtonStyles}
        >
          <Pencil size={16} />
        </Button>
        <Button
          variant="secondary"
          size="small"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label={t("course-plans-task-delete", { task: task.title })}
          className={cx(taskActionButtonStyles, taskDeleteButtonStyles)}
        >
          <Trash size={16} />
        </Button>
      </div>
    </li>
  )
}

function toFormValues(task: CourseDesignerPlanStageTask): TaskEditFormValues {
  return {
    title: task.title,
    description: task.description ?? "",
    assigneeUserId: task.assignee_user_id ?? UNASSIGNED,
  }
}
