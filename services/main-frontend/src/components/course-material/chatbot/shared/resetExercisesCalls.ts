import { z } from "zod"

import type { ClientToolName } from "@/generated/course-material-api/types.generated"
import { parseJsonWithSchema } from "@/shared-module/common/utils/parseJsonWithSchema"

/**
 * The client tool this UI answers, matching `ResetExercisesTool::NAME` in
 * `services/headless-lms/chatbot/src/chatbot_tools/action_tools/reset_exercises.rs`.
 */
export const RESET_EXERCISES_TOOL: ClientToolName = "reset_exercises"

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
  const args = parseJsonWithSchema(toolArguments, rawArguments)
  if (!args) {
    return null
  }
  if (args.exercise_ids.length !== args.exercise_names.length) {
    return null
  }
  const userEmail = args.user_email.trim()
  const courseName = args.course_name.trim()
  const reason = args.reason.trim()
  if (userEmail.length === 0 || courseName.length === 0 || reason.length === 0) {
    return null
  }
  return {
    toolCallId,
    userId: args.user_id,
    courseId: args.course_id,
    userEmail,
    courseName,
    exerciseIds: args.exercise_ids,
    exerciseNames: args.exercise_names,
    reason,
  }
}

const zResetExercisesCall = z.object({
  toolCallId: z.string(),
  userId: z.string(),
  courseId: z.string(),
  userEmail: z.string(),
  courseName: z.string(),
  exerciseIds: z.array(z.string()),
  exerciseNames: z.array(z.string()),
  reason: z.string(),
})

/**
 * Narrows a client tool registry entry's `unknown` call back to this tool's own type. Always true
 * for a call this tool's own `parseResetExercisesCall` produced.
 */
export const isResetExercisesCall = (call: unknown): call is ResetExercisesCall =>
  zResetExercisesCall.safeParse(call).success
