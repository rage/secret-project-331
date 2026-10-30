"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"

import { aiPolicyLabel } from "@/app/(layout)/manage/courses/[id]/overview/EditCourseForm/AiPolicyFields"
import type {
  CompletionPolicy,
  EntityField,
  FieldChange,
  FieldValue,
} from "@/generated/api/types.generated"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"
import { ABSENT_LABEL, Table } from "@/shared-module/components"

import BeforeAfterTabs from "./BeforeAfterTabs"
import { StagedBlocks } from "./StagedPageContent"
import { useEntityName } from "./useEntityName"

function fieldLabels(t: TFunction): Record<EntityField, string> {
  return {
    title: t("agent-field-title"),
    url_path: t("agent-field-url-path"),
    hidden: t("agent-field-hidden"),
    chapter_id: t("agent-field-chapter"),
    order_number: t("agent-field-order-number"),
    name: t("agent-field-name"),
    color: t("agent-field-color"),
    chapter_number: t("agent-field-chapter-number"),
    course_module_id: t("agent-field-module"),
    front_page_id: t("heading-chapter-front-page"),
    opens_at: t("agent-field-opens-at"),
    deadline: t("agent-field-deadline"),
    chapter_image_path: t("agent-field-chapter-image"),
    completion_policy: t("agent-field-completion-policy"),
    certification_enabled: t("enable-module-completion-certificates"),
    uh_course_code: t("agent-field-course-code"),
    ects_credits: t("agent-field-ects-credits"),
    completion_registration_link_override: t("completion-registration-link"),
    completions_can_be_registered_to_sisu: t("completions-can-be-registered-to-sisu"),
    description: t("agent-field-description"),
    is_draft: t("agent-field-is-draft"),
    is_test_mode: t("agent-field-is-test-mode"),
    is_unlisted: t("agent-field-is-unlisted"),
    can_add_chatbot: t("can-enable-chatbot"),
    is_joinable_by_code_only: t("joinable-by-code-only"),
    ask_marketing_consent: t("label-ask-for-marketing-consent"),
    flagged_answers_threshold: t("label-threshold-to-move-flagged-answer-to-manual-review"),
    flagged_answers_skip_manual_review_and_allow_retry: t(
      "label-flagged-answers-skip-manual-review-and-allow-retry",
    ),
    closed_at: t("course-closing-time-label"),
    closed_additional_message: t("course-closing-note-label"),
    closed_course_successor_id: t("course-closing-successor-label"),
    chapter_locking_enabled: t("agent-field-chapter-locking"),
    ai_policy: t("ai-policy-label"),
    course_material_ai_instructions: t("course-material-ai-instructions-label"),
    base_module_completion_requires_n_submodule_completions: t(
      "agent-field-required-module-completions",
    ),
    audiences: t("audiences-fieldset-title"),
    term: t("agent-field-term"),
    definition: t("agent-field-definition"),
    citation_key: t("agent-field-citation-key"),
    reference: t("agent-field-reference"),
    review_instructions: t("agent-field-review-instructions"),
    exercise_name: t("agent-field-exercise-name"),
    exercise_deadline: t("agent-field-exercise-deadline"),
    task_instructions: t("agent-field-task-instructions"),
    review_config: t("agent-field-review-config"),
  }
}

function completionPolicyText(policy: CompletionPolicy, t: TFunction): string {
  if (policy.policy === "manual") {
    return t("agent-completion-policy-manual")
  }
  const requirements: string[] = []
  const points = policy.number_of_points_treshold
  if (typeof points === "number") {
    requirements.push(t("agent-completion-points", { count: points }))
  }
  const exercises = policy.number_of_exercises_attempted_treshold
  if (typeof exercises === "number") {
    requirements.push(t("agent-completion-exercises-attempted", { count: exercises }))
  }
  if (policy.requires_exam) {
    requirements.push(t("agent-completion-requires-exam"))
  }
  return requirements.length === 0
    ? t("agent-completion-policy-automatic")
    : t("agent-completion-policy-automatic-with", { requirements: requirements.join(", ") })
}

/** A field is unique per entity, except exercise fields, which repeat per exercise and task. */
function changeKey(change: FieldChange): string {
  return [change.field, change.exercise?.exercise_id, change.exercise?.task_id].join(":")
}

function isBlocksChange(change: FieldChange): boolean {
  return change.before?.type === "blocks" || change.after?.type === "blocks"
}

function blocksOf(value: FieldValue | null | undefined): unknown[] {
  return value?.type === "blocks" && Array.isArray(value.value) ? value.value : []
}

const BlocksChange: React.FC<{ change: FieldChange; label: string }> = ({ change, label }) => {
  const column = (value: FieldValue | null | undefined) => {
    const blocks = blocksOf(value)
    return blocks.length > 0 ? (
      <StagedBlocks blocks={blocks} isConstrainedToContainer embeddedUnderHeadingLevel={4} />
    ) : (
      <p>{ABSENT_LABEL}</p>
    )
  }
  return (
    <section data-testid="agent-blocks-change" aria-label={label}>
      <h4
        className={css`
          font-size: 1rem;
          font-weight: ${fontWeights.semibold};
          color: ${baseTheme.colors.gray[700]};
          margin: 0 0 0.5rem 0;
        `}
      >
        {label}
      </h4>
      <BeforeAfterTabs
        before={column(change.before)}
        after={column(change.after)}
        data-testid-prefix="agent-blocks"
      />
    </section>
  )
}

interface FieldChangesProps {
  changes: FieldChange[]
  caption: string
}

/** Field by field what a change does to an entity: chapters, modules, settings, glossary. */
const FieldChanges: React.FC<FieldChangesProps> = ({ changes, caption }) => {
  const { t } = useTranslation()
  const entityName = useEntityName()
  if (changes.length === 0) {
    return null
  }
  const labels = fieldLabels(t)
  const tableChanges = changes.filter((change) => !isBlocksChange(change))
  const blocksChanges = changes.filter((change) => isBlocksChange(change))
  const blocksChangeLabel = (change: FieldChange): string => {
    const field = labels[change.field]
    if (!change.exercise) {
      return field
    }
    const {
      exercise_id: exerciseId,
      exercise_name: exerciseName,
      task_id: taskId,
    } = change.exercise
    if (!taskId) {
      return t("agent-exercise-field-label", { exercise: exerciseName, field })
    }
    const sameExerciseTasks = blocksChanges.filter(
      (other) => other.field === change.field && other.exercise?.exercise_id === exerciseId,
    )
    return sameExerciseTasks.length > 1
      ? t("agent-exercise-field-label-task", {
          exercise: exerciseName,
          field,
          number: sameExerciseTasks.indexOf(change) + 1,
        })
      : t("agent-exercise-field-label", { exercise: exerciseName, field })
  }
  const valueText = (value: FieldValue | null | undefined): string => {
    if (!value) {
      return ABSENT_LABEL
    }
    switch (value.type) {
      case "text":
        return value.value
      case "number":
        return String(value.value)
      case "bool":
        return value.value ? t("yes") : t("no")
      case "date_time":
        return dateToString(value.value)
      case "reference":
        return entityName(value.value)
      case "text_list":
        return value.value.length > 0 ? value.value.join(", ") : ABSENT_LABEL
      case "completion_policy":
        return completionPolicyText(value.value, t)
      case "ai_policy":
        return aiPolicyLabel(value.value, t)
      case "blocks":
        return ABSENT_LABEL
      case "review_config":
        return value.value === "course_default"
          ? t("agent-review-config-course-default")
          : t("agent-review-config-own")
    }
  }
  const valueColumn = (
    header: string,
    valueOf: (change: FieldChange) => FieldValue | null | undefined,
  ) => ({
    header,
    grow: true,
    breakAnywhere: true,
    cell: (change: FieldChange) => (
      <span
        className={css`
          white-space: pre-wrap;
        `}
      >
        {valueText(valueOf(change))}
      </span>
    ),
  })
  const table = tableChanges.length > 0 && (
    <Table
      caption={caption}
      data-testid="agent-field-changes"
      // oxlint-disable-next-line i18next/no-literal-string
      density="compact"
      // oxlint-disable-next-line i18next/no-literal-string
      responsive="stack"
      rows={tableChanges}
      rowKey={changeKey}
      columns={[
        {
          header: t("agent-field"),
          cell: (change) =>
            change.exercise
              ? t("agent-exercise-field-label", {
                  exercise: change.exercise.exercise_name,
                  field: labels[change.field],
                })
              : labels[change.field],
          nowrap: true,
        },
        valueColumn(t("agent-before"), (change) => change.before),
        valueColumn(t("agent-after"), (change) => change.after),
      ]}
    />
  )
  return (
    <>
      {table}
      {blocksChanges.map((change) => (
        <BlocksChange key={changeKey(change)} change={change} label={blocksChangeLabel(change)} />
      ))}
    </>
  )
}

export default FieldChanges
