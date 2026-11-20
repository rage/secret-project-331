import type { CourseModuleCreditRegistrationConfig } from "@/generated/api/types.generated"

/** Whether a module's completions are registered. Mirrors `course_modules::registers_credits` on the server. */
export const registersCredits = (
  module: Pick<
    CourseModuleCreditRegistrationConfig,
    "uh_course_code" | "credit_registration_route"
  >,
): boolean =>
  module.credit_registration_route === "platform" && Boolean(module.uh_course_code?.trim())
