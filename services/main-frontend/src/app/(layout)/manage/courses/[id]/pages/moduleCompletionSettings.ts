import type {
  CompletionMethod,
  CompletionPolicy,
  CreditRegistrationRoute,
  ExamRequirement,
  OrgExam,
} from "@/generated/api/types.generated"

/** A module's completion and credit settings as the modules page stages them before saving. */
export interface ModuleCompletionSettings {
  completion_method: CompletionMethod
  number_of_points_treshold: number | null
  number_of_exercises_attempted_treshold: number | null
  exam_requirement: ExamRequirement
  exam_location_description: string | null
  credit_registration_route: CreditRegistrationRoute
  uh_course_code: string | null
  ects_credits: number | null
  completion_registration_link_override: string | null
  certification_enabled: boolean
}

/** What a module starts with: nothing decided, so nobody passes until the teacher chooses. */
export const NEW_MODULE_COMPLETION_SETTINGS: ModuleCompletionSettings = {
  completion_method: "not_decided",
  number_of_points_treshold: null,
  number_of_exercises_attempted_treshold: null,
  exam_requirement: "none",
  exam_location_description: null,
  credit_registration_route: "platform",
  uh_course_code: null,
  ects_credits: null,
  completion_registration_link_override: null,
  certification_enabled: false,
}

/** An exam linked to the course, as the module settings list it. */
export interface LinkedExam {
  id: string
  name: string
  starts_at: string | null
  ends_at: string | null
  /** Completes the students who reach it automatically; `null` when graded manually or unset. */
  pass_mark: number | null
}

/** Mirrors the server's rule: an exam graded manually or with a zero threshold passes nobody. */
export const linkedExamOf = (exam: OrgExam): LinkedExam => ({
  id: exam.id,
  name: exam.name,
  starts_at: exam.starts_at ?? null,
  ends_at: exam.ends_at ?? null,
  pass_mark:
    !exam.grade_manually && exam.minimum_points_treshold > 0 ? exam.minimum_points_treshold : null,
})

/** Where the form's "Where will the exam be held?" answer can point. */
export type ExamLocation = Exclude<ExamRequirement, "none">

/** Whether the platform can see the exam's results: it can't for Examinarium or elsewhere. */
export const isOutsidePlatform = (exam: ExamRequirement): boolean =>
  exam === "examinarium" || exam === "elsewhere"

/** The completion method a module with these settings has, with its thresholds. */
export const completionPolicyOf = (
  courseModuleId: string,
  settings: Pick<
    ModuleCompletionSettings,
    "completion_method" | "number_of_points_treshold" | "number_of_exercises_attempted_treshold"
  >,
): CompletionPolicy => {
  const method = settings.completion_method
  if (method === "by_requirements" || method === "by_exam") {
    return {
      method,
      course_module_id: courseModuleId,
      number_of_points_treshold: settings.number_of_points_treshold,
      number_of_exercises_attempted_treshold: settings.number_of_exercises_attempted_treshold,
    }
  }
  return { method }
}

/** The settings a saved `CourseModule` carries, flattened. */
export const settingsOfPolicy = (
  policy: CompletionPolicy,
): Pick<
  ModuleCompletionSettings,
  "completion_method" | "number_of_points_treshold" | "number_of_exercises_attempted_treshold"
> =>
  policy.method === "by_requirements" || policy.method === "by_exam"
    ? {
        completion_method: policy.method,
        number_of_points_treshold: policy.number_of_points_treshold ?? null,
        number_of_exercises_attempted_treshold:
          policy.number_of_exercises_attempted_treshold ?? null,
      }
    : {
        completion_method: policy.method,
        number_of_points_treshold: null,
        number_of_exercises_attempted_treshold: null,
      }
