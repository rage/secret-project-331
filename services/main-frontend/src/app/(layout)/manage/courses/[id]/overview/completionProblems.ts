import type {
  CourseCompletionOverview,
  CourseModuleCompletionOverview,
} from "@/generated/api/types.generated"

/** Something a module's settings or state does to students that the teacher should know about. */
export type ModuleProblem =
  | { kind: "not-decided" }
  | { kind: "registered-outside"; isExaminarium: boolean }
  | { kind: "registration-link-missing" }
  | { kind: "no-exam-has-pass-mark" }
  | { kind: "examinarium-access" }
  | { kind: "certificate-only" }

type ModuleProblemKind = ModuleProblem["kind"]

/** The rest are worth checking: the platform can't tell whether they are a problem. */
const NEEDS_ACTION: ReadonlySet<ModuleProblemKind> = new Set([
  "not-decided",
  "registered-outside",
  "registration-link-missing",
])

/** Whether a problem is counted in "N things need action" and shown as a tinted line. */
export const needsAction = (problem: ModuleProblem): boolean => NEEDS_ACTION.has(problem.kind)

/** The one line a module's status row says, when there is anything worth saying. */
export type ModuleStatus =
  | { kind: "waiting-for-exam" }
  | { kind: "no-completions-yet" }
  | { kind: "not-tracked" }
  | { kind: "not-yet-registered"; count: number }

/** One module as the completion panel shows it. */
export interface ModuleCompletionState {
  module: CourseModuleCompletionOverview
  status: ModuleStatus | null
  problems: ModuleProblem[]
}

/** Support's pause on the course's credit registration; informational, never counted. */
export interface RegistrationPause {
  pausedAt: string
  reason: string | null
}

/** Everything the completion panel shows, with its header counts. */
export interface CourseCompletionState {
  modules: ModuleCompletionState[]
  /** Course codes Sisu has refused, each once however many modules share it. Needs action. */
  rejectedCourseCodes: string[]
  pauses: RegistrationPause[]
  needsActionCount: number
  toCheckCount: number
}

const statusOf = (
  module: CourseModuleCompletionOverview,
  overview: CourseCompletionOverview,
): ModuleStatus | null => {
  if (module.credit_registration_route === "external") {
    return { kind: "not-tracked" }
  }
  if (module.credit_registration_route === "platform" && module.not_yet_registered_count > 0) {
    return { kind: "not-yet-registered", count: module.not_yet_registered_count }
  }
  if (
    module.completion_method === "by_exam" &&
    module.exam_requirement === "platform" &&
    overview.exams.count === 0
  ) {
    return { kind: "waiting-for-exam" }
  }
  if (
    (module.exam_requirement === "examinarium" || module.exam_requirement === "elsewhere") &&
    !module.has_completions
  ) {
    return { kind: "no-completions-yet" }
  }
  return null
}

const problemsOf = (
  module: CourseModuleCompletionOverview,
  overview: CourseCompletionOverview,
  isDraft: boolean,
): ModuleProblem[] => {
  const problems: ModuleProblem[] = []
  if (module.completion_method === "not_decided" && !isDraft) {
    problems.push({ kind: "not-decided" })
  }
  if (module.credit_registration_route === "external") {
    problems.push({
      kind: "registered-outside",
      isExaminarium: module.exam_requirement === "examinarium",
    })
  }
  if (module.credit_registration_route === "platform" && !module.has_registration_link) {
    problems.push({ kind: "registration-link-missing" })
  }
  if (
    module.completion_method === "by_exam" &&
    overview.exams.pass_marks === "none_have_pass_mark"
  ) {
    problems.push({ kind: "no-exam-has-pass-mark" })
  }
  if (module.exam_requirement === "examinarium" && !module.has_completions) {
    problems.push({ kind: "examinarium-access" })
  }
  if (module.credit_registration_route === "certificate_only") {
    problems.push({ kind: "certificate-only" })
  }
  return problems
}

/** Works out what the Overview's completion panel flags, and how loudly. */
export const courseCompletionStateOf = (
  overview: CourseCompletionOverview,
  isDraft: boolean,
): CourseCompletionState => {
  const modules = overview.modules
    .toSorted((l, r) => l.order_number - r.order_number)
    .map((module) => ({
      module,
      status: statusOf(module, overview),
      problems: problemsOf(module, overview, isDraft),
    }))

  const rejectedCourseCodes = [
    ...new Set(
      overview.modules
        .filter(
          (module) =>
            module.credit_registration_route === "platform" &&
            module.course_code_allowed === false &&
            module.uh_course_code,
        )
        .map((module) => module.uh_course_code as string),
    ),
  ]

  const pauses = new Map<string, RegistrationPause>()
  for (const courseModule of overview.modules) {
    if (courseModule.credit_registration_paused_at) {
      const pause = {
        pausedAt: courseModule.credit_registration_paused_at,
        reason: courseModule.credit_registration_pause_reason?.trim() || null,
      }
      pauses.set(`${pause.pausedAt}|${pause.reason ?? ""}`, pause)
    }
  }

  const allProblems = modules.flatMap((m) => m.problems)
  const needsActionProblemCount = allProblems.filter((problem) => needsAction(problem)).length
  return {
    modules,
    rejectedCourseCodes,
    pauses: [...pauses.values()],
    needsActionCount: needsActionProblemCount + rejectedCourseCodes.length,
    toCheckCount: allProblems.length - needsActionProblemCount,
  }
}
