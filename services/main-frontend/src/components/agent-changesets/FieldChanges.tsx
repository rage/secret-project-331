"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"

import { dateToString } from "@/shared-module/common/utils/time"
import { ABSENT_LABEL, Table } from "@/shared-module/components"

/** Fields a teacher has no use for in a diff: ids, and page content shown rendered instead. */
const HIDDEN_FIELDS = new Set([
  "id",
  "course_id",
  "content",
  "exercises",
  "exercise_slides",
  "exercise_tasks",
])

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

function fieldLabel(field: string, t: TFunction): string {
  switch (field) {
    case "title":
      return t("agent-field-title")
    case "url_path":
      return t("agent-field-url-path")
    case "hidden":
      return t("agent-field-hidden")
    case "chapter_id":
      return t("agent-field-chapter")
    case "order_number":
      return t("agent-field-order-number")
    case "name":
      return t("agent-field-name")
    case "description":
      return t("agent-field-description")
    case "chapter_number":
      return t("agent-field-chapter-number")
    case "opens_at":
      return t("agent-field-opens-at")
    case "deadline":
      return t("agent-field-deadline")
    case "color":
      return t("agent-field-color")
    case "course_module_id":
      return t("agent-field-module")
    case "completion_policy":
      return t("agent-field-completion-policy")
    case "ects_credits":
      return t("agent-field-ects-credits")
    case "uh_course_code":
      return t("agent-field-course-code")
    case "is_draft":
      return t("agent-field-is-draft")
    case "is_test_mode":
      return t("agent-field-is-test-mode")
    case "is_unlisted":
      return t("agent-field-is-unlisted")
    case "chapter_locking_enabled":
      return t("agent-field-chapter-locking")
    case "term":
      return t("agent-field-term")
    case "definition":
      return t("agent-field-definition")
    case "citation_key":
      return t("agent-field-citation-key")
    case "reference":
      return t("agent-field-reference")
    default:
      return field
  }
}

function formatValue(value: unknown, t: TFunction): string {
  if (value === null || value === undefined) {
    return ABSENT_LABEL
  }
  if (typeof value === "boolean") {
    return value ? t("yes") : t("no")
  }
  if (typeof value === "string") {
    return ISO_DATE_TIME.test(value) ? dateToString(value) : value
  }
  if (typeof value === "number") {
    return String(value)
  }
  return JSON.stringify(value)
}

function asRecord(snapshot: unknown): Record<string, unknown> {
  return snapshot !== null && typeof snapshot === "object"
    ? (snapshot as Record<string, unknown>)
    : {}
}

interface FieldChange {
  field: string
  before: unknown
  after: unknown
}

/** The fields that differ between two entity snapshots; `null` stands for a missing entity. */
export function changedFields(before: unknown, after: unknown): FieldChange[] {
  const beforeRecord = asRecord(before)
  const afterRecord = asRecord(after)
  const fields = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])
  return [...fields]
    .filter((field) => !HIDDEN_FIELDS.has(field))
    .filter((field) => JSON.stringify(beforeRecord[field]) !== JSON.stringify(afterRecord[field]))
    .map((field) => ({ field, before: beforeRecord[field], after: afterRecord[field] }))
}

interface FieldChangesProps {
  before: unknown
  after: unknown
  caption: string
}

/** Field by field what a change does to an entity: chapters, modules, settings, glossary. */
const FieldChanges: React.FC<FieldChangesProps> = ({ before, after, caption }) => {
  const { t } = useTranslation()
  const changes = changedFields(before, after)
  if (changes.length === 0) {
    return null
  }
  return (
    <Table
      caption={caption}
      data-testid="agent-field-changes"
      // oxlint-disable-next-line i18next/no-literal-string
      density="compact"
      // oxlint-disable-next-line i18next/no-literal-string
      responsive="stack"
      rows={changes}
      rowKey={(change) => change.field}
      columns={[
        { header: t("agent-field"), cell: (change) => fieldLabel(change.field, t), nowrap: true },
        {
          header: t("agent-before"),
          grow: true,
          breakAnywhere: true,
          cell: (change) => (
            <span
              className={css`
                white-space: pre-wrap;
              `}
            >
              {formatValue(change.before, t)}
            </span>
          ),
        },
        {
          header: t("agent-after"),
          grow: true,
          breakAnywhere: true,
          cell: (change) => (
            <span
              className={css`
                white-space: pre-wrap;
              `}
            >
              {formatValue(change.after, t)}
            </span>
          ),
        },
      ]}
    />
  )
}

export default FieldChanges
