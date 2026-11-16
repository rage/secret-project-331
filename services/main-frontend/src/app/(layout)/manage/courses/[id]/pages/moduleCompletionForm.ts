import type {
  CompletionMethod,
  CreditRegistrationRoute,
  ExamRequirement,
} from "@/generated/api/types.generated"

import type { ExamLocation, ModuleCompletionSettings } from "./moduleCompletionSettings"

/** "By requirements" and "By the exam" are one option; which one depends on the exam. */
export type PassMethod = "not_decided" | "automatic" | "teacher_adds"

/** The module editor's own fields: the completion settings as the form asks for them. */
export interface CourseModuleFormState {
  name: string | null
  /** Chapter numbers as the select holds them. */
  starts: string
  ends: string
  exam_required: "yes" | "no"
  /** Empty until the teacher picks one. */
  exam_location: ExamLocation | ""
  exam_location_description: string
  pass_method: PassMethod
  requires_points: boolean
  number_of_points_treshold: number | null
  requires_exercises: boolean
  number_of_exercises_attempted_treshold: number | null
  credit_registration_route: CreditRegistrationRoute
  certification_enabled: boolean
  uh_course_code: string
  ects_credits: number | null
  completion_registration_link_override: string
}

/** What the module editor hands back. */
export interface CourseModuleFormFields extends ModuleCompletionSettings {
  name: string | null
  starts: number
  ends: number
}

/** The editor's starting values for a module spanning chapters `starts` to `ends`. */
export const formStateOf = (
  module: ModuleCompletionSettings & { name: string | null },
  starts: number,
  ends: number,
): CourseModuleFormState => {
  const method = module.completion_method
  return {
    name: module.name,
    starts: String(starts),
    ends: String(ends),
    exam_required: module.exam_requirement === "none" ? "no" : "yes",
    exam_location: module.exam_requirement === "none" ? "" : module.exam_requirement,
    exam_location_description: module.exam_location_description ?? "",
    pass_method: method === "by_requirements" || method === "by_exam" ? "automatic" : method,
    requires_points: module.number_of_points_treshold !== null,
    number_of_points_treshold: module.number_of_points_treshold,
    requires_exercises: module.number_of_exercises_attempted_treshold !== null,
    number_of_exercises_attempted_treshold: module.number_of_exercises_attempted_treshold,
    credit_registration_route: module.credit_registration_route,
    certification_enabled: module.certification_enabled,
    uh_course_code: module.uh_course_code ?? "",
    ects_credits: module.ects_credits,
    completion_registration_link_override: module.completion_registration_link_override ?? "",
  }
}

/** The exam requirement the two exam questions amount to. */
export const examRequirementOf = (
  state: Pick<CourseModuleFormState, "exam_required" | "exam_location">,
): ExamRequirement =>
  state.exam_required === "no" || state.exam_location === "" ? "none" : state.exam_location

const trimmedOrNull = (value: string): string | null => value.trim() || null

/** The settings the editor's answers amount to; thresholds are dropped unless students pass by them. */
export const formFieldsOf = (state: CourseModuleFormState): CourseModuleFormFields => {
  const exam_requirement = examRequirementOf(state)
  const isAutomatic = state.pass_method === "automatic"
  const completion_method: CompletionMethod =
    state.pass_method !== "automatic"
      ? state.pass_method
      : exam_requirement === "platform"
        ? "by_exam"
        : "by_requirements"
  return {
    name: state.name,
    starts: Number(state.starts),
    ends: Number(state.ends),
    completion_method,
    number_of_points_treshold:
      isAutomatic && state.requires_points ? state.number_of_points_treshold : null,
    number_of_exercises_attempted_treshold:
      isAutomatic && state.requires_exercises ? state.number_of_exercises_attempted_treshold : null,
    exam_requirement,
    exam_location_description:
      exam_requirement === "elsewhere" ? trimmedOrNull(state.exam_location_description) : null,
    credit_registration_route: state.credit_registration_route,
    uh_course_code: trimmedOrNull(state.uh_course_code),
    ects_credits: state.ects_credits,
    completion_registration_link_override: trimmedOrNull(
      state.completion_registration_link_override,
    ),
    certification_enabled: state.certification_enabled,
  }
}

/**
 * Passing by requirements with none chosen, which would pass everyone. An exam on this platform
 * is a requirement of its own, so passing by it needs none.
 */
export const lacksRequirement = (
  state: Pick<
    CourseModuleFormState,
    "pass_method" | "exam_required" | "exam_location" | "requires_points" | "requires_exercises"
  >,
): boolean =>
  state.pass_method === "automatic" &&
  examRequirementOf(state) !== "platform" &&
  !state.requires_points &&
  !state.requires_exercises
