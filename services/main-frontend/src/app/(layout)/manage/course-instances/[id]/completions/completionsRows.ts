import type { SortingState } from "@tanstack/react-table"

import { registrationNeedsAttention } from "@/components/credit-registration/creditRegistrationCopy"
import type { CreditRegistrationIndex } from "@/components/credit-registration/teacherCreditRegistrations"
import { creditRegistrationKey } from "@/components/credit-registration/teacherCreditRegistrations"
import type {
  CourseModuleCompletionWithRegistrationInfo,
  UserWithModuleCompletions,
} from "@/generated/api/types.generated"

/** One student of the instance, with every completion they have per module, oldest first. */
export interface CompletionsRow {
  userId: string
  firstName: string | null
  lastName: string | null
  email: string
  /** Lowercased name, email and id; the search filter scans every student on every keystroke. */
  searchText: string
  /** What the student column sorts on: "Last First", or the email when neither name is known. */
  sortableName: string
  moduleCompletions: Map<string, CourseModuleCompletionWithRegistrationInfo[]>
}

/** What one module column shows: the newest attempt, and how many there have been. */
export interface ModuleCompletionSummary {
  latest: CourseModuleCompletionWithRegistrationInfo | null
  attempts: number
}

/** Which students the list is narrowed to. */
export type CompletionsView = "everyone" | "needs_attention" | "awaiting_review" | "not_completed"

export const COMPLETIONS_VIEWS: CompletionsView[] = [
  "everyone",
  "needs_attention",
  "awaiting_review",
  "not_completed",
]

export const DEFAULT_COMPLETIONS_VIEW: CompletionsView = "everyone"

/** Marks a grade whose module still awaits its prerequisite modules; the table footnote explains it. */
export const PREREQUISITE_MARK = "*"

export const PREREQUISITE_FOOTNOTE_PREFIX = `${PREREQUISITE_MARK}: `

/** The student column's sort key; every other `sorting[0].id` is a course module id. */
export const STUDENT_COLUMN_ID = "student"

const EMPTY_SUMMARY: ModuleCompletionSummary = { latest: null, attempts: 0 }

export const toCompletionsRows = (users: UserWithModuleCompletions[]): CompletionsRow[] =>
  users.map((user) => {
    const moduleCompletions = new Map<string, CourseModuleCompletionWithRegistrationInfo[]>()
    for (const completion of user.completed_modules) {
      const bucket = moduleCompletions.get(completion.course_module_id) ?? []
      bucket.push(completion)
      moduleCompletions.set(completion.course_module_id, bucket)
    }
    for (const completions of moduleCompletions.values()) {
      // ISO 8601 timestamps compare lexicographically; collation would only cost more.
      completions.sort((a, b) =>
        a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0,
      )
    }
    const firstName = user.first_name ?? null
    const lastName = user.last_name ?? null
    return {
      userId: user.user_id,
      firstName,
      lastName,
      email: user.email,
      searchText:
        `${firstName ?? ""} ${lastName ?? ""} ${user.email} ${user.user_id}`.toLowerCase(),
      sortableName: `${lastName ?? ""} ${firstName ?? ""}`.trim() || user.email,
      moduleCompletions,
    }
  })

export const moduleSummaryOf = (row: CompletionsRow, moduleId: string): ModuleCompletionSummary => {
  const completions = row.moduleCompletions.get(moduleId)
  if (!completions) {
    return EMPTY_SUMMARY
  }
  const latest = completions.at(-1)
  return latest ? { latest, attempts: completions.length } : EMPTY_SUMMARY
}

/** Where a pass and a fail with no numeric grade sit on the scale numeric grades sort on. */
export const PASS_GRADE_VALUE = 0.5
export const FAIL_GRADE_VALUE = -1
/** Below every attempt: the student has no completion for the module at all. */
const NO_COMPLETION_VALUE = -2

/**
 * One completion's place on the grade order, shared by the column sorter and the manual-completion
 * preview's "previous best grade".
 */
export const gradeSortValue = (grade: number | null | undefined, passed: boolean): number =>
  grade ?? (passed ? PASS_GRADE_VALUE : FAIL_GRADE_VALUE)

const gradeRank = (summary: ModuleCompletionSummary): number =>
  summary.latest === null
    ? NO_COMPLETION_VALUE
    : gradeSortValue(summary.latest.grade, summary.latest.passed)

const needsAttention = (
  row: CompletionsRow,
  moduleIds: string[],
  creditRegistrations: CreditRegistrationIndex,
): boolean =>
  moduleIds.some((moduleId) => {
    const registration = creditRegistrations.get(creditRegistrationKey(row.userId, moduleId))
    return (
      registration !== undefined && registrationNeedsAttention(registration.student_facing_status)
    )
  })

const awaitsReview = (row: CompletionsRow, moduleIds: string[]): boolean =>
  moduleIds.some((moduleId) => moduleSummaryOf(row, moduleId).latest?.needs_to_be_reviewed === true)

export interface CompletionsFilter {
  search: string
  view: CompletionsView
  moduleIds: string[]
  creditRegistrations: CreditRegistrationIndex
}

export const filterCompletionsRows = (
  rows: CompletionsRow[],
  { search, view, moduleIds, creditRegistrations }: CompletionsFilter,
): CompletionsRow[] => {
  const needle = search.trim().toLowerCase()
  return rows.filter((row) => {
    if (needle !== "" && !row.searchText.includes(needle)) {
      return false
    }
    if (view === "needs_attention") {
      return needsAttention(row, moduleIds, creditRegistrations)
    }
    if (view === "awaiting_review") {
      return awaitsReview(row, moduleIds)
    }
    if (view === "not_completed") {
      return row.moduleCompletions.size === 0
    }
    return true
  })
}

const nameCollator = new Intl.Collator()

/** Sorted here rather than by the server: the endpoint hands back the whole instance at once. */
export const sortCompletionsRows = (
  rows: CompletionsRow[],
  sorting: SortingState,
): CompletionsRow[] => {
  const sort = sorting[0]
  if (!sort) {
    return rows
  }
  const direction = sort.desc ? -1 : 1
  const compare =
    sort.id === STUDENT_COLUMN_ID
      ? (a: CompletionsRow, b: CompletionsRow) =>
          nameCollator.compare(a.sortableName, b.sortableName)
      : (a: CompletionsRow, b: CompletionsRow) =>
          gradeRank(moduleSummaryOf(a, sort.id)) - gradeRank(moduleSummaryOf(b, sort.id))
  return rows.toSorted((a, b) => direction * compare(a, b))
}
