import type { CourseModuleCreditRegistrationConfig } from "@/generated/api/types.generated"

export interface CreditRegistrationModuleFields {
  enabled: boolean
}

export const EMPTY_CREDIT_REGISTRATION_FIELDS: CreditRegistrationModuleFields = {
  enabled: false,
}

export const creditRegistrationFieldsOf = (
  configs: CourseModuleCreditRegistrationConfig[] | undefined,
  moduleId: string,
): CreditRegistrationModuleFields => {
  const config = configs?.find((m) => m.course_module_id === moduleId)
  if (!config) {
    return EMPTY_CREDIT_REGISTRATION_FIELDS
  }
  return {
    enabled: config.enable_credit_registration_via_suotar,
  }
}
