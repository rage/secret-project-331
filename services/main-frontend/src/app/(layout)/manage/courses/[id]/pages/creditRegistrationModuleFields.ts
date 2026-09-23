import type {
  CourseCreditRegistrationModuleConfigs,
  CourseModuleCreditRegistrationEdit,
} from "@/generated/api/types.generated"

/** Strings rather than nullable strings, since a text input has no null. */
export interface CreditRegistrationModuleFields {
  enabled: boolean
  grade_scale_id: string
}

/** Must match the scale ids the backend's grade mapping accepts. */
export const PASS_FAIL_GRADE_SCALE_ID = "sis-hyl-hyv"
export const NUMERIC_GRADE_SCALE_ID = "sis-0-5"

/** The value the grade scale select uses for "derive from the completion". */
export const DERIVED_GRADE_SCALE = ""

export const EMPTY_CREDIT_REGISTRATION_FIELDS: CreditRegistrationModuleFields = {
  enabled: false,
  grade_scale_id: DERIVED_GRADE_SCALE,
}

export const creditRegistrationFieldsOf = (
  configs: CourseCreditRegistrationModuleConfigs | undefined,
  moduleId: string,
): CreditRegistrationModuleFields => {
  const config = configs?.modules.find((m) => m.course_module_id === moduleId)
  if (!config) {
    return EMPTY_CREDIT_REGISTRATION_FIELDS
  }
  return {
    enabled: config.enable_credit_registration_via_suotar,
    grade_scale_id: config.credit_registration_grade_scale_id ?? DERIVED_GRADE_SCALE,
  }
}

const trimmedOrNull = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

export const toCreditRegistrationEdit = (
  fields: CreditRegistrationModuleFields,
): CourseModuleCreditRegistrationEdit => ({
  grade_scale_id: trimmedOrNull(fields.grade_scale_id),
})
