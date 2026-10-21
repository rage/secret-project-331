import type { CourseModuleCreditRegistrationConfig } from "@/generated/api/types.generated"

/** Whether a module's completions are registered. Mirrors `course_modules::registers_credits` on the server. */
export const registersCredits = (
  module: Pick<
    CourseModuleCreditRegistrationConfig,
    "uh_course_code" | "completions_can_be_registered_to_sisu"
  >,
): boolean => module.completions_can_be_registered_to_sisu && Boolean(module.uh_course_code?.trim())
