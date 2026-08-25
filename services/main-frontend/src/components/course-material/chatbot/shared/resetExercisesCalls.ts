import { z } from "zod"

import type { ClientToolName } from "@/generated/course-material-api/types.generated"

/**
 * The client tool this UI answers, generated from `ClientToolName` in
 * `services/headless-lms/chatbot/src/chatbot_tools/mod.rs`. Cast rather than typed as
 * `ClientToolName` directly: the backend variant is added in a later wiring pass alongside the
 * other action tools, so the generated union does not carry this literal yet.
 */
export const RESET_EXERCISES_TOOL = "reset_exercises" as ClientToolName

/** The arguments `ResetExercisesTool::parse_arguments` validates further server-side. */
const rawArguments = z.object({
  user_id: z.string(),
  course_id: z.string(),
  user_email: z.string(),
  course_name: z.string(),
  exercise_ids: z.array(z.string()),
  exercise_names: z.array(z.string()),
  reason: z.string(),
})

export interface ResetExercisesCall {
  toolCallId: string
  userId: string
  courseId: string
  userEmail: string
  courseName: string
  exerciseIds: string[]
  exerciseNames: string[]
  reason: string
}

/**
 * The call's raw arguments, parsed into what the bubble needs to render, or null if they cannot
 * be made sense of. This is the client tool registry's `parseCall` for this tool.
 */
export const parseResetExercisesCall = (
  toolCallId: string,
  toolArguments: string,
): ResetExercisesCall | null => {
  let parsedArguments: unknown
  try {
    parsedArguments = JSON.parse(toolArguments)
  } catch {
    return null
  }
  const args = rawArguments.safeParse(parsedArguments)
  if (!args.success) {
    return null
  }
  if (args.data.exercise_ids.length !== args.data.exercise_names.length) {
    return null
  }
  const userEmail = args.data.user_email.trim()
  const courseName = args.data.course_name.trim()
  const reason = args.data.reason.trim()
  if (userEmail.length === 0 || courseName.length === 0 || reason.length === 0) {
    return null
  }
  return {
    toolCallId,
    userId: args.data.user_id,
    courseId: args.data.course_id,
    userEmail,
    courseName,
    exerciseIds: args.data.exercise_ids,
    exerciseNames: args.data.exercise_names,
    reason,
  }
}

/**
 * Narrows a client tool registry entry's `unknown` call back to this tool's own type. Always true
 * for a call this tool's own `parseResetExercisesCall` produced.
 */
export const isResetExercisesCall = (call: unknown): call is ResetExercisesCall => {
  const candidate = call as Partial<ResetExercisesCall> | null
  return (
    !!candidate &&
    typeof candidate.toolCallId === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.courseId === "string" &&
    typeof candidate.userEmail === "string" &&
    typeof candidate.courseName === "string" &&
    Array.isArray(candidate.exerciseIds) &&
    Array.isArray(candidate.exerciseNames) &&
    typeof candidate.reason === "string"
  )
}
