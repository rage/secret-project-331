import type {
  CourseCreditRegistrationModuleConfigs,
  CourseModuleCreditRegistrationEdit,
} from "@/generated/api/types.generated"

/** Strings rather than nullable strings, since a text input has no null. */
export interface CreditRegistrationModuleFields {
  enabled: boolean
  open_university_product_id: string
  grade_scale_id: string
  realisations: RealisationFields[]
}

export interface RealisationFields {
  course_unit_realisation_id: string
  label: string
  active: boolean
}

/** Must match the scale ids the backend's grade mapping accepts. */
export const PASS_FAIL_GRADE_SCALE_ID = "sis-hyl-hyv"
export const NUMERIC_GRADE_SCALE_ID = "sis-0-5"

/** The value the grade scale select uses for "derive from the completion". */
export const DERIVED_GRADE_SCALE = ""

export const EMPTY_CREDIT_REGISTRATION_FIELDS: CreditRegistrationModuleFields = {
  enabled: false,
  open_university_product_id: "",
  grade_scale_id: DERIVED_GRADE_SCALE,
  realisations: [],
}

export const EMPTY_REALISATION: RealisationFields = {
  course_unit_realisation_id: "",
  label: "",
  active: true,
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
    open_university_product_id: config.open_university_product_id ?? "",
    grade_scale_id: config.credit_registration_grade_scale_id ?? DERIVED_GRADE_SCALE,
    realisations: (configs?.realisations ?? [])
      .filter((r) => r.course_module_id === moduleId)
      .map((r) => ({
        course_unit_realisation_id: r.course_unit_realisation_id,
        label: r.label ?? "",
        active: r.active,
      })),
  }
}

const trimmedOrNull = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

export const toCreditRegistrationEdit = (
  fields: CreditRegistrationModuleFields,
): CourseModuleCreditRegistrationEdit => ({
  open_university_product_id: trimmedOrNull(fields.open_university_product_id),
  grade_scale_id: trimmedOrNull(fields.grade_scale_id),
  realisations: fields.realisations
    .filter((r) => r.course_unit_realisation_id.trim() !== "")
    .map((r) => ({
      course_unit_realisation_id: r.course_unit_realisation_id.trim(),
      label: trimmedOrNull(r.label),
      active: r.active,
    })),
})
