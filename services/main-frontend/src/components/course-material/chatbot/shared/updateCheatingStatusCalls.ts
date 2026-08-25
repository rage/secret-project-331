import { z } from "zod"

import type { ClientToolName } from "@/generated/course-material-api/types.generated"

/**
 * The client tool this UI answers, generated from `ClientToolName` in
 * `services/headless-lms/chatbot/src/chatbot_tools/mod.rs`. Cast rather than typed as
 * `ClientToolName` directly: the backend variant is added in a later wiring pass alongside the
 * other action tools, so the generated union does not carry this literal yet.
 */
export const UPDATE_CHEATING_STATUS_TOOL = "update_cheating_status" as ClientToolName

const decision = z.union([z.literal("confirm"), z.literal("dismiss")])

export type CheatingDecision = z.infer<typeof decision>

/** The arguments `UpdateCheatingStatusTool::parse_arguments` validates further server-side. */
const rawArguments = z.object({
  user_id: z.string(),
  course_id: z.string(),
  user_email: z.string(),
  course_name: z.string(),
  decision,
})

export interface UpdateCheatingStatusCall {
  toolCallId: string
  userId: string
  courseId: string
  userEmail: string
  courseName: string
  decision: CheatingDecision
}

/**
 * The call's raw arguments, parsed into what the bubble needs to render, or null if they cannot
 * be made sense of. This is the client tool registry's `parseCall` for this tool.
 */
export const parseUpdateCheatingStatusCall = (
  toolCallId: string,
  toolArguments: string,
): UpdateCheatingStatusCall | null => {
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
  const userEmail = args.data.user_email.trim()
  const courseName = args.data.course_name.trim()
  if (userEmail.length === 0 || courseName.length === 0) {
    return null
  }
  return {
    toolCallId,
    userId: args.data.user_id,
    courseId: args.data.course_id,
    userEmail,
    courseName,
    decision: args.data.decision,
  }
}

/**
 * Narrows a client tool registry entry's `unknown` call back to this tool's own type. Always true
 * for a call this tool's own `parseUpdateCheatingStatusCall` produced.
 */
export const isUpdateCheatingStatusCall = (call: unknown): call is UpdateCheatingStatusCall => {
  const candidate = call as Partial<UpdateCheatingStatusCall> | null
  return (
    !!candidate &&
    typeof candidate.toolCallId === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.courseId === "string" &&
    typeof candidate.userEmail === "string" &&
    typeof candidate.courseName === "string" &&
    (candidate.decision === "confirm" || candidate.decision === "dismiss")
  )
}
