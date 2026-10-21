/** Whether a module with this course code registers credits. Mirrors `course_modules::registers_credits` on the server. */
export const registersCredits = (courseCode: string | null | undefined): boolean =>
  Boolean(courseCode?.trim())
