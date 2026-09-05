import type { SortingState } from "@tanstack/react-table"

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

/** Registration stages a teacher or their student can still do something about. */
const NEEDS_ATTENTION_STATUSES: ReadonlySet<StudentFacingCreditRegistrationStatus> = new Set([
  "failed",
  "needs_student_number",
  "needs_enrolment",
])

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
      completions.sort((a, b) => a.created_at.localeCompare(b.created_at))
    }
    return {
      userId: user.user_id,
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null,
      email: user.email,
      moduleCompletions,
    }
  })

export const moduleSummaryOf = (row: CompletionsRow, moduleId: string): ModuleCompletionSummary => {
  const completions = row.moduleCompletions.get(moduleId)
  const latest = completions?.at(-1)
  return latest ? { latest, attempts: completions?.length ?? 1 } : EMPTY_SUMMARY
}

const sortableName = (row: CompletionsRow): string =>
  `${row.lastName ?? ""} ${row.firstName ?? ""}`.trim() || row.email

/** Ranks a module's newest attempt so that "no completion" sorts below a fail. */
const gradeRank = (summary: ModuleCompletionSummary): number => {
  if (summary.latest === null) {
    return -2
  }
  const grade = summary.latest.grade
  if (grade !== null && grade !== undefined) {
    return grade
  }
  return summary.latest.passed ? 0.5 : -1
}

const matchesSearch = (row: CompletionsRow, needle: string): boolean =>
  `${row.firstName ?? ""} ${row.lastName ?? ""} ${row.email} ${row.userId}`
    .toLowerCase()
    .includes(needle)

const needsAttention = (
  row: CompletionsRow,
  moduleIds: string[],
  creditRegistrations: CreditRegistrationIndex,
): boolean =>
  moduleIds.some((moduleId) => {
    const registration = creditRegistrations.get(creditRegistrationKey(row.userId, moduleId))
    return (
      registration !== undefined && NEEDS_ATTENTION_STATUSES.has(registration.student_facing_status)
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
    if (needle !== "" && !matchesSearch(row, needle)) {
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

/**
 * Sorted here rather than by the server: the endpoint hands back the whole instance at once.
 * `sorting[0].id` is either `studentColumnId` or a course module id.
 */
export const sortCompletionsRows = (
  rows: CompletionsRow[],
  sorting: SortingState,
  studentColumnId: string,
): CompletionsRow[] => {
  const sort = sorting[0]
  if (!sort) {
    return rows
  }
  const direction = sort.desc ? -1 : 1
  const compare =
    sort.id === studentColumnId
      ? (a: CompletionsRow, b: CompletionsRow) => sortableName(a).localeCompare(sortableName(b))
      : (a: CompletionsRow, b: CompletionsRow) =>
          gradeRank(moduleSummaryOf(a, sort.id)) - gradeRank(moduleSummaryOf(b, sort.id))
  return rows.toSorted((a, b) => direction * compare(a, b))
}
