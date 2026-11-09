import type { TFunction } from "i18next"

import {
  CONTENT_FORMAT_FIELDS,
  CONTRIBUTOR_ROLES,
} from "../workspace/components/analysis-form/analysisFormDomain"
import {
  PLANNED_CONTENT_FORMATS,
  STYLE_GUIDE_ITEMS,
  WORKLOAD_ACTIVITY_TYPES,
} from "../workspace/components/design-form/designFormDomain"

const FIELD_LABEL_KEYS = {
  course_title: "course-plans-analysis-field-course-title",
  credits: "course-plans-analysis-field-credits",
  language: "course-plans-analysis-field-language",
  target_group: "course-plans-analysis-field-target-group",
  responsible_teachers: "course-plans-analysis-field-teachers-in-charge",
  degree_programme: "course-plans-analysis-field-degree-programme",
  course_type: "course-plans-analysis-field-course-type",
  students_demographic_data: "course-plans-analysis-field-students-demographic",
  wishes_topics: "course-plans-analysis-field-wishes-topics",
  wishes_content_format_notes: "course-plans-analysis-field-content-format-notes",
  wishes_assessment_text: "course-plans-analysis-field-assessment",
  wishes_other_suggestions: "course-plans-analysis-field-wishes-other",
  market_results: "course-plans-analysis-field-market-results",
  resources_university: "course-plans-analysis-field-resources-university",
  resources_purchase_budget: "course-plans-analysis-field-resources-purchase",
  mode_synchronous: "course-plans-analysis-mode-synchronous",
  mode_asynchronous: "course-plans-analysis-mode-asynchronous",
  open_period_all: "course-plans-analysis-period-all",
  open_period_i: "course-plans-analysis-period-i",
  open_period_ii: "course-plans-analysis-period-ii",
  open_period_iii: "course-plans-analysis-period-iii",
  open_period_iv: "course-plans-analysis-period-iv",
  ...Object.fromEntries(CONTENT_FORMAT_FIELDS),
  ...Object.fromEntries(CONTRIBUTOR_ROLES.map((role) => [role.field, role.nameKey] as const)),
  learning_goals: "course-plans-design-section-learning-goals",
  core_content_must_know: "course-plans-design-core-content-must",
  core_content_should_know: "course-plans-design-core-content-should",
  core_content_nice_to_know: "course-plans-design-core-content-nice",
  chapters: "course-plans-design-section-course-structure",
  planned_content_formats: "course-plans-design-formats-planned",
  content_format_notes: "course-plans-design-formats-notes",
  accessibility_notes: "course-plans-design-accessibility-notes",
  style_guide: "course-plans-design-section-style-guide",
  exercise_notes: "course-plans-design-exercise-notes",
  workload_activities: "course-plans-design-workload-heading",
} as const

/**
 * The label key `map` has for a stored string, if any. Stored strings come from the model, so a
 * miss is expected and the caller shows the string as it is.
 */
export function labelKeyOf<K extends string>(
  map: Readonly<Partial<Record<string, K>>>,
  key: string,
): K | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined
}

/** Field groups whose own label is prefixed to their items' labels. */
const GROUP_LABEL_KEYS = {
  mode_synchronous: "course-plans-analysis-field-mode",
  mode_asynchronous: "course-plans-analysis-field-mode",
  open_period_all: "course-plans-analysis-field-open-periods",
  open_period_i: "course-plans-analysis-field-open-periods",
  open_period_ii: "course-plans-analysis-field-open-periods",
  open_period_iii: "course-plans-analysis-field-open-periods",
  open_period_iv: "course-plans-analysis-field-open-periods",
  ...Object.fromEntries(
    CONTENT_FORMAT_FIELDS.map(
      ([field]) => [field, "course-plans-analysis-field-content-format"] as const,
    ),
  ),
} as const

const NESTED_LABEL_KEYS = {
  planned_content_formats: Object.fromEntries(
    PLANNED_CONTENT_FORMATS.map((format) => [format.format, format.labelKey] as const),
  ),
  style_guide: Object.fromEntries(
    STYLE_GUIDE_ITEMS.map((item) => [item.item, item.labelKey] as const),
  ),
} as const

const CHAPTER_FIELD_LABEL_KEYS = {
  title: "course-plans-design-chapter-title",
  learning_objectives: "course-plans-design-chapter-objectives",
  topics: "course-plans-design-chapter-pages",
} as const

/** Labels for keys inside list items, such as a chapter's or a workload activity's fields. */
export const ITEM_FIELD_LABEL_KEYS = {
  ...CHAPTER_FIELD_LABEL_KEYS,
  activity_type: "course-plans-design-workload-activity-type",
  count: "course-plans-design-workload-count",
  minutes_each: "course-plans-design-workload-minutes-each",
} as const

export const STAGE_LABEL_KEYS = {
  analysis: "course-plans-stage-analysis",
  design: "course-plans-stage-design",
  development: "course-plans-stage-development",
  implementation: "course-plans-stage-implementation",
  evaluation: "course-plans-stage-evaluation",
} as const

export const SECTION_STATUS_LABEL_KEYS = {
  ready: "course-plans-section-status-ready",
  unfinished: "course-plans-section-status-unfinished",
  not_marked: "course-plans-section-status-not-marked",
} as const

export const TASK_FIELD_LABEL_KEYS = {
  title: "course-plans-task-title-label",
  description: "course-plans-task-description-label",
  is_completed: "course-plans-assistant-task-done",
  assignee: "course-plans-task-assignee-label",
} as const

/** Labels for stored enum values the forms show by name. */
export const VALUE_LABEL_KEYS = {
  compulsory: "course-plans-analysis-course-type-compulsory",
  elective: "course-plans-analysis-course-type-elective",
  ...Object.fromEntries(
    WORKLOAD_ACTIVITY_TYPES.map((entry) => [entry.type, entry.labelKey] as const),
  ),
} as const

/**
 * The form's name for a workspace field path as the assistant's tools write it (`style_guide.font`,
 * `chapters.<chapter id>.topics`). Paths the forms have no label for are returned as they are.
 */
export function workspaceFieldLabel(
  path: string,
  chapterNumberById: ReadonlyMap<string, number>,
  t: TFunction,
): string {
  const [head = "", ...rest] = path.split(".")
  const inGroup = (group: string, field: string) =>
    t("course-plans-assistant-field-in-group", { group, field })
  const headKey = labelKeyOf(FIELD_LABEL_KEYS, head)

  if (rest.length === 0) {
    if (!headKey) {
      return path
    }
    const groupKey = labelKeyOf(GROUP_LABEL_KEYS, head)
    return groupKey ? inGroup(t(groupKey), t(headKey)) : t(headKey)
  }
  const nestedKey =
    rest.length === 1 && (head === "planned_content_formats" || head === "style_guide")
      ? labelKeyOf(NESTED_LABEL_KEYS[head], rest[0] ?? "")
      : undefined
  if (headKey && nestedKey) {
    return inGroup(t(headKey), t(nestedKey))
  }
  if (head === "chapters" && rest.length === 2) {
    const [chapterId = "", field = ""] = rest
    const number = chapterNumberById.get(chapterId)
    const fieldKey = labelKeyOf(CHAPTER_FIELD_LABEL_KEYS, field)
    if (number !== undefined && fieldKey) {
      return inGroup(t("course-plans-design-chapter-heading", { number }), t(fieldKey))
    }
  }
  return path
}
