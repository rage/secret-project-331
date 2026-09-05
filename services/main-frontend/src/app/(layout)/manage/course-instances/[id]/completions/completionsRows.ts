import type { SortingState } from "@tanstack/react-table"

import { widenedLookup } from "@/components/credit-registration/labelFrom"
import type { RegistrationStatusView } from "@/components/credit-registration/registrationStatusViews"
import {
  REGISTRATION_STATUS_VIEWS,
  registrationStatusesOf,
} from "@/components/credit-registration/registrationStatusViews"
import type { CreditRegistrationIndex } from "@/components/credit-registration/teacherCreditRegistrations"
import { creditRegistrationKey } from "@/components/credit-registration/teacherCreditRegistrations"
import type {
  CourseModuleCompletionWithRegistrationInfo,
  StudentFacingCreditRegistrationStatus,
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

/**
 * Which students the list is narrowed to: one of the shared registration views, or one of the two
 * narrowings that are about the completion rather than its registration.
 */
export type CompletionsView = RegistrationStatusView | "awaiting_review" | "not_completed"

/** Narrowings by completion, kept apart from the registration views in the picker. */
export const COMPLETION_ONLY_VIEWS: CompletionsView[] = ["awaiting_review", "not_completed"]

export const REGISTRATION_VIEWS: CompletionsView[] = REGISTRATION_STATUS_VIEWS

export const DEFAULT_COMPLETIONS_VIEW: CompletionsView = "everyone"

/** Marks a grade whose module still awaits its prerequisite modules; the table footnote explains it. */
export const PREREQUISITE_MARK = "*"

export const PREREQUISITE_FOOTNOTE_PREFIX = `${PREREQUISITE_MARK}: `

/** The student column's sort key; every other `sorting[0].id` is a module id or a registration one. */
export const STUDENT_COLUMN_ID = "student"

/** Suffix that turns a module id into its registration column's sort key. */
const REGISTRATION_COLUMN_SUFFIX = "__registration"

export const registrationColumnId = (moduleId: string): string =>
  `${moduleId}${REGISTRATION_COLUMN_SUFFIX}`

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

const matchesRegistrationView = (
  row: CompletionsRow,
  moduleIds: string[],
  creditRegistrations: CreditRegistrationIndex,
  view: RegistrationStatusView,
): boolean => {
  const statuses = registrationStatusesOf(view)
  if (statuses.length === 0) {
    return true
  }
  return moduleIds.some((moduleId) => {
    const registration = creditRegistrations.get(creditRegistrationKey(row.userId, moduleId))
    return registration !== undefined && statuses.includes(registration.student_facing_status)
  })
}

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
    if (view === "awaiting_review") {
      return awaitsReview(row, moduleIds)
    }
    if (view === "not_completed") {
      return row.moduleCompletions.size === 0
    }
    return matchesRegistrationView(row, moduleIds, creditRegistrations, view)
  })
}

/**
 * How far along a registration is, so ascending puts the rows a teacher can still do something
 * about at the top. A student with no registration at all sorts last.
 */
const STATUS_ORDER = {
  failed: 0,
  needs_student_number: 1,
  needs_enrolment: 1,
  waiting_for_completion: 2,
  in_progress: 3,
  waiting_for_sisu: 3,
  registered: 4,
  not_registering: 5,
} as const satisfies Record<StudentFacingCreditRegistrationStatus, number>

const NO_REGISTRATION_ORDER = 6

const registrationRank = (
  row: CompletionsRow,
  moduleId: string,
  creditRegistrations: CreditRegistrationIndex,
): number => {
  const registration = creditRegistrations.get(creditRegistrationKey(row.userId, moduleId))
  if (!registration) {
    return NO_REGISTRATION_ORDER
  }
  return widenedLookup(STATUS_ORDER, registration.student_facing_status) ?? NO_REGISTRATION_ORDER
}

const nameCollator = new Intl.Collator()

const comparerFor = (
  columnId: string,
  creditRegistrations: CreditRegistrationIndex,
): ((a: CompletionsRow, b: CompletionsRow) => number) => {
  if (columnId === STUDENT_COLUMN_ID) {
    return (a, b) => nameCollator.compare(a.sortableName, b.sortableName)
  }
  if (columnId.endsWith(REGISTRATION_COLUMN_SUFFIX)) {
    const moduleId = columnId.slice(0, -REGISTRATION_COLUMN_SUFFIX.length)
    return (a, b) =>
      registrationRank(a, moduleId, creditRegistrations) -
      registrationRank(b, moduleId, creditRegistrations)
  }
  return (a, b) => gradeRank(moduleSummaryOf(a, columnId)) - gradeRank(moduleSummaryOf(b, columnId))
}

/** Sorted here rather than by the server: the endpoint hands back the whole instance at once. */
export const sortCompletionsRows = (
  rows: CompletionsRow[],
  sorting: SortingState,
  creditRegistrations: CreditRegistrationIndex,
): CompletionsRow[] => {
  const sort = sorting[0]
  if (!sort) {
    return rows
  }
  const direction = sort.desc ? -1 : 1
  const compare = comparerFor(sort.id, creditRegistrations)
  return rows.toSorted((a, b) => direction * compare(a, b))
}
